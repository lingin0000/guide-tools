use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use quick_xml::de::from_str;
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::Emitter;
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageUploadResult {
    pub original_path: String,
    pub oss_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OSSConfig {
    pub access_key_id: String,
    pub access_key_secret: String,
    pub bucket: String,
    pub region: String,
    pub endpoint: Option<String>,
    pub file_path: Option<String>,
}

impl OSSConfig {
    // 验证配置
    fn validate(&self) -> Result<(), OSSError> {
        if self.access_key_id.is_empty() {
            return Err(OSSError::InvalidConfig("access_key_id is empty".to_string()));
        }
        if self.access_key_secret.is_empty() {
            return Err(OSSError::InvalidConfig("access_key_secret is empty".to_string()));
        }
        if self.bucket.is_empty() {
            return Err(OSSError::InvalidConfig("bucket is empty".to_string()));
        }
        if self.region.is_empty() {
            return Err(OSSError::InvalidConfig("region is empty".to_string()));
        }
        Ok(())
    }

    // 获取endpoint
    fn get_endpoint(&self) -> String {
        self.endpoint.clone().unwrap_or_else(|| {
            format!("https://{}.oss-{}.aliyuncs.com", self.bucket, self.region)
        })
    }

    // 获取OSS目录
    fn get_oss_dir(&self) -> String {
        self.file_path.clone().unwrap_or_else(|| DEFAULT_OSS_DIR.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OSSTreeNode {
    pub key: String,
    pub title: String,
    pub path: String,
    pub node_type: String,
    pub last_modified: Option<String>,
    pub children: Vec<OSSTreeNode>,
    pub is_leaf: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OSSFileContentResult {
    pub file_path: String,
    pub file_name: String,
    pub content: String,
    pub preview_content: String,
    pub content_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OSSLocalPathMapping {
    pub object_key: String,
    pub local_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OSSDownloadResult {
    pub saved_path: String,
    pub mappings: Vec<OSSLocalPathMapping>,
    pub total_items: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OSSDownloadProgressPayload {
    pub task_id: String,
    pub current_item: String,
    pub completed: usize,
    pub total: usize,
    pub stage: String,
}

#[derive(Debug, Deserialize, Default)]
struct OSSListBucketResult {
    #[serde(rename = "Contents", default)]
    contents: Vec<OSSObjectContent>,
    #[serde(rename = "CommonPrefixes", default)]
    common_prefixes: Vec<OSSCommonPrefix>,
    #[serde(rename = "IsTruncated", default)]
    is_truncated: bool,
    #[serde(rename = "NextMarker")]
    next_marker: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OSSObjectContent {
    #[serde(rename = "Key")]
    key: String,
    #[serde(rename = "LastModified")]
    last_modified: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OSSCommonPrefix {
    #[serde(rename = "Prefix")]
    prefix: String,
}

fn build_authorization_header(
    method: &str,
    content_type: &str,
    date: &str,
    canonicalized_oss_headers: &str,
    canonicalized_resource: &str,
    access_key_id: &str,
    access_key_secret: &str,
) -> String {
    let signature = generate_oss_signature(
        method,
        "",
        content_type,
        date,
        canonicalized_oss_headers,
        canonicalized_resource,
        access_key_secret,
    );
    format!("OSS {}:{}", access_key_id, signature)
}

fn normalize_oss_prefix(prefix: &str) -> String {
    let trimmed = prefix.trim().trim_matches('/');
    if trimmed.is_empty() {
        String::new()
    } else {
        format!("{}/", trimmed)
    }
}

fn join_oss_path(base_prefix: &str, child: &str) -> String {
    let normalized_base = base_prefix.trim().trim_matches('/');
    let normalized_child = child.trim().trim_matches('/');

    match (normalized_base.is_empty(), normalized_child.is_empty()) {
        (true, true) => String::new(),
        (true, false) => normalized_child.to_string(),
        (false, true) => normalized_base.to_string(),
        (false, false) => format!("{}/{}", normalized_base, normalized_child),
    }
}

fn sanitize_oss_file_name(file_name: &str) -> String {
    file_name
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '_' | '-' => ch,
            _ => '_',
        })
        .collect()
}

fn build_image_object_key(oss_dir: &str, file_name: &str) -> String {
    let now = chrono::Local::now();
    let date_folder = now.format("%Y/%m/%d").to_string();
    let readable_timestamp = now.format("%Y%m%d-%H%M%S-%3f").to_string();
    let sanitized_file_name = sanitize_oss_file_name(file_name);
    let base_prefix = oss_dir.trim().trim_matches('/');

    if base_prefix.is_empty() {
        format!("{}/{}_{}", date_folder, readable_timestamp, sanitized_file_name)
    } else {
        format!(
            "{}/{}/{}_{}",
            base_prefix, date_folder, readable_timestamp, sanitized_file_name
        )
    }
}

fn display_oss_path(path: &str) -> String {
    path.trim_end_matches('/').to_string()
}

fn build_oss_object_url(endpoint: &str, object_key: &str) -> String {
    format!(
        "{}/{}",
        endpoint.trim_end_matches('/'),
        object_key.trim_start_matches('/')
    )
}

fn encode_oss_copy_source(bucket: &str, object_key: &str) -> String {
    let encoded_segments = object_key
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| utf8_percent_encode(segment, NON_ALPHANUMERIC).to_string())
        .collect::<Vec<_>>()
        .join("/");
    format!("/{}/{}", bucket.trim_matches('/'), encoded_segments)
}

fn is_text_key(object_key: &str) -> bool {
    matches!(
        Path::new(object_key)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "md"
            | "markdown"
            | "txt"
            | "json"
            | "js"
            | "jsx"
            | "ts"
            | "tsx"
            | "css"
            | "html"
            | "xml"
            | "yml"
            | "yaml"
            | "toml"
            | "ini"
            | "csv"
            | "log"
            | "rs"
            | "py"
            | "java"
            | "kt"
            | "go"
            | "sh"
            | "sql"
    )
}

fn get_text_content_type(object_key: &str) -> String {
    if is_markdown_key(object_key) {
        "markdown".to_string()
    } else {
        "text".to_string()
    }
}

fn extract_node_name(path: &str) -> String {
    let normalized = path.trim_end_matches('/');
    normalized
        .split('/')
        .filter(|segment| !segment.is_empty())
        .last()
        .unwrap_or(normalized)
        .to_string()
}

fn is_markdown_key(object_key: &str) -> bool {
    matches!(
        Path::new(object_key)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "md" | "markdown"
    )
}

fn normalize_oss_object_path(path: &str) -> String {
    let mut segments = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            value => segments.push(value),
        }
    }
    segments.join("/")
}

fn markdown_image_regex() -> Regex {
    Regex::new(r"!\[[^\]]*]\(([^)]+)\)").expect("invalid markdown image regex")
}

fn extract_markdown_image_paths(markdown: &str) -> Vec<String> {
    markdown_image_regex()
        .captures_iter(markdown)
        .filter_map(|capture| capture.get(1).map(|value| value.as_str().trim().to_string()))
        .filter(|path| !path.starts_with("data:"))
        .collect()
}

fn replace_markdown_image_paths(markdown: &str, mappings: &HashMap<String, String>) -> String {
    markdown_image_regex()
        .replace_all(markdown, |captures: &regex::Captures| {
            let original_path = captures
                .get(1)
                .map(|value| value.as_str())
                .unwrap_or_default();
            if let Some(replaced_path) = mappings.get(original_path) {
                return captures[0].replace(original_path, replaced_path);
            }
            captures[0].to_string()
        })
        .to_string()
}

fn resolve_image_object_key(
    image_path: &str,
    markdown_object_key: &str,
    endpoint: &str,
) -> Option<String> {
    if image_path.starts_with("http://") || image_path.starts_with("https://") {
        let object_prefix = format!("{}/", endpoint.trim_end_matches('/'));
        return image_path
            .strip_prefix(&object_prefix)
            .map(normalize_oss_object_path);
    }

    if image_path.starts_with('/') {
        return Some(normalize_oss_object_path(image_path.trim_start_matches('/')));
    }

    let parent_prefix = markdown_object_key
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    let combined_path = if parent_prefix.is_empty() {
        image_path.to_string()
    } else {
        format!("{}/{}", parent_prefix, image_path)
    };

    Some(normalize_oss_object_path(&combined_path))
}

fn build_relative_object_path(object_key: &str, prefix: &str) -> PathBuf {
    let relative_path = object_key
        .strip_prefix(prefix)
        .unwrap_or(object_key)
        .trim_start_matches('/');
    let mut path = PathBuf::new();
    for segment in relative_path.split('/') {
        if !segment.is_empty() {
            path.push(segment);
        }
    }
    path
}

fn build_local_asset_relative_path(
    markdown_file_name: &str,
    image_key: &str,
    selected_prefix: &str,
    root_prefix: &str,
) -> PathBuf {
    let markdown_stem = Path::new(markdown_file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("assets");
    let asset_source_key = if image_key.starts_with(selected_prefix) {
        build_relative_object_path(image_key, selected_prefix)
    } else if image_key.starts_with(root_prefix) {
        build_relative_object_path(image_key, root_prefix)
    } else {
        build_relative_object_path(image_key, "")
    };

    let mut asset_path = PathBuf::from("_assets");
    asset_path.push(markdown_stem);
    asset_path.push(asset_source_key);
    asset_path
}

fn path_to_markdown_link(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn emit_download_progress(
    app_handle: &tauri::AppHandle,
    task_id: &str,
    current_item: &str,
    completed: usize,
    total: usize,
    stage: &str,
) {
    let _ = app_handle.emit(
        "oss-download-progress",
        OSSDownloadProgressPayload {
            task_id: task_id.to_string(),
            current_item: current_item.to_string(),
            completed,
            total,
            stage: stage.to_string(),
        },
    );
}

async fn list_oss_objects_page(
    oss_config: &OSSConfig,
    prefix: &str,
    marker: Option<&str>,
) -> Result<OSSListBucketResult, OSSError> {
    let endpoint = oss_config.get_endpoint();
    let date = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();
    let canonicalized_resource = format!("/{}/", oss_config.bucket);
    let authorization = build_authorization_header(
        "GET",
        "",
        &date,
        "",
        &canonicalized_resource,
        &oss_config.access_key_id,
        &oss_config.access_key_secret,
    );

    let max_keys = "1000".to_string();
    let delimiter = "/".to_string();
    let prefix_value = prefix.to_string();
    let marker_value = marker.unwrap_or("").to_string();

    let response = Client::new()
        .get(&endpoint)
        .header("Authorization", authorization)
        .header("Date", date)
        .query(&[
            ("prefix", prefix_value.as_str()),
            ("delimiter", delimiter.as_str()),
            ("marker", marker_value.as_str()),
            ("max-keys", max_keys.as_str()),
        ])
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;

    if !status.is_success() {
        return Err(OSSError::ListFailed(body));
    }

    from_str::<OSSListBucketResult>(&body)
        .map_err(|error| OSSError::ResponseParse(error.to_string()))
}

async fn list_all_oss_objects(
    oss_config: &OSSConfig,
    prefix: &str,
) -> Result<OSSListBucketResult, OSSError> {
    let mut all_contents = Vec::new();
    let mut all_common_prefixes = Vec::new();
    let mut marker: Option<String> = None;

    loop {
        let page = list_oss_objects_page(oss_config, prefix, marker.as_deref()).await?;
        let next_marker = page.next_marker.clone().or_else(|| {
            page.common_prefixes
                .last()
                .map(|item| item.prefix.clone())
                .or_else(|| page.contents.last().map(|item| item.key.clone()))
        });

        all_contents.extend(page.contents);
        all_common_prefixes.extend(page.common_prefixes);

        if !page.is_truncated {
            break;
        }

        marker = next_marker;
        if marker.is_none() {
            break;
        }
    }

    Ok(OSSListBucketResult {
        contents: all_contents,
        common_prefixes: all_common_prefixes,
        is_truncated: false,
        next_marker: None,
    })
}

async fn read_oss_object_bytes(
    oss_config: &OSSConfig,
    object_key: &str,
) -> Result<Vec<u8>, OSSError> {
    let endpoint = oss_config.get_endpoint();
    let date = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();
    let canonicalized_resource = format!("/{}/{}", oss_config.bucket, object_key);
    let authorization = build_authorization_header(
        "GET",
        "",
        &date,
        "",
        &canonicalized_resource,
        &oss_config.access_key_id,
        &oss_config.access_key_secret,
    );
    let url = build_oss_object_url(&endpoint, object_key);
    let response = Client::new()
        .get(url)
        .header("Authorization", authorization)
        .header("Date", date)
        .send()
        .await?;
    let status = response.status();
    let bytes = response.bytes().await?;

    if !status.is_success() {
        return Err(OSSError::ObjectReadFailed(
            String::from_utf8_lossy(&bytes).to_string(),
        ));
    }

    Ok(bytes.to_vec())
}

async fn read_oss_object_text(
    oss_config: &OSSConfig,
    object_key: &str,
) -> Result<String, OSSError> {
    let bytes = read_oss_object_bytes(oss_config, object_key).await?;
    String::from_utf8(bytes).map_err(|error| OSSError::ObjectReadFailed(error.to_string()))
}

fn build_oss_children(prefix: &str, list_result: OSSListBucketResult) -> Vec<OSSTreeNode> {
    let _ = prefix;
    let mut directory_nodes = Vec::new();
    let mut file_nodes = Vec::new();

    for common_prefix in list_result.common_prefixes {
        let node_path = display_oss_path(&common_prefix.prefix);
        directory_nodes.push(OSSTreeNode {
            key: node_path.clone(),
            title: extract_node_name(&common_prefix.prefix),
            path: node_path,
            node_type: "directory".to_string(),
            last_modified: None,
            children: Vec::new(),
            is_leaf: false,
        });
    }

    for object in list_result.contents {
        if object.key == prefix || object.key.ends_with('/') {
            continue;
        }

        file_nodes.push(OSSTreeNode {
            key: object.key.clone(),
            title: extract_node_name(&object.key),
            path: object.key,
            node_type: "file".to_string(),
            last_modified: object.last_modified,
            children: Vec::new(),
            is_leaf: true,
        });
    }

    directory_nodes.sort_by(|left, right| left.title.cmp(&right.title));
    file_nodes.sort_by(|left, right| left.title.cmp(&right.title));
    directory_nodes.extend(file_nodes);

    directory_nodes
}

async fn list_oss_children(prefix: &str, oss_config: &OSSConfig) -> Result<Vec<OSSTreeNode>, OSSError> {
    let list_result = list_all_oss_objects(oss_config, prefix).await?;
    Ok(build_oss_children(prefix, list_result))
}

async fn collect_markdown_keys(
    root_prefix: &str,
    oss_config: &OSSConfig,
) -> Result<Vec<String>, OSSError> {
    let mut markdown_keys = Vec::new();
    let mut pending_prefixes = vec![root_prefix.to_string()];

    while let Some(current_prefix) = pending_prefixes.pop() {
        let list_result = list_all_oss_objects(oss_config, &current_prefix).await?;
        for common_prefix in list_result.common_prefixes {
            pending_prefixes.push(common_prefix.prefix);
        }
        for object in list_result.contents {
            if object.key == current_prefix || object.key.ends_with('/') {
                continue;
            }
            if is_markdown_key(&object.key) {
                markdown_keys.push(object.key);
            }
        }
    }

    markdown_keys.sort();
    Ok(markdown_keys)
}

async fn collect_object_keys(
    root_prefix: &str,
    oss_config: &OSSConfig,
) -> Result<Vec<String>, OSSError> {
    let mut object_keys = Vec::new();
    let mut pending_prefixes = vec![root_prefix.to_string()];

    while let Some(current_prefix) = pending_prefixes.pop() {
        let list_result = list_all_oss_objects(oss_config, &current_prefix).await?;
        for common_prefix in list_result.common_prefixes {
            pending_prefixes.push(common_prefix.prefix);
        }
        for object in list_result.contents {
            if object.key == current_prefix || object.key.ends_with('/') {
                continue;
            }
            object_keys.push(object.key);
        }
    }

    object_keys.sort();
    Ok(object_keys)
}

async fn collect_single_markdown_key(
    object_key: &str,
    oss_config: &OSSConfig,
) -> Result<Vec<String>, OSSError> {
    if !is_markdown_key(object_key) {
        return Err(OSSError::InvalidPath("当前文件不是 Markdown 文件".to_string()));
    }

    let _ = read_oss_object_text(oss_config, object_key).await?;
    Ok(vec![object_key.to_string()])
}

fn build_markdown_preview_content(
    markdown_content: &str,
    object_key: &str,
    oss_config: &OSSConfig,
) -> String {
    let endpoint = oss_config.get_endpoint();
    let mut mappings = HashMap::new();

    for image_path in extract_markdown_image_paths(markdown_content) {
        if let Some(image_key) = resolve_image_object_key(&image_path, object_key, &endpoint) {
            mappings.insert(image_path, build_oss_object_url(&endpoint, &image_key));
        }
    }

    replace_markdown_image_paths(markdown_content, &mappings)
}

fn deduplicate_image_refs(
    markdown_content: &str,
    markdown_key: &str,
    endpoint: &str,
) -> Vec<(String, String)> {
    let mut image_mappings = HashMap::new();

    for image_path in extract_markdown_image_paths(markdown_content) {
        if let Some(image_key) = resolve_image_object_key(&image_path, markdown_key, endpoint) {
            image_mappings.entry(image_path).or_insert(image_key);
        }
    }

    image_mappings.into_iter().collect()
}

async fn prepare_markdown_downloads(
    markdown_keys: Vec<String>,
    oss_config: &OSSConfig,
) -> Result<Vec<(String, String, Vec<(String, String)>)>, OSSError> {
    let endpoint = oss_config.get_endpoint();
    let mut prepared = Vec::new();

    for markdown_key in markdown_keys {
        let markdown_content = read_oss_object_text(oss_config, &markdown_key).await?;
        let image_refs = deduplicate_image_refs(&markdown_content, &markdown_key, &endpoint);
        prepared.push((markdown_key, markdown_content, image_refs));
    }

    Ok(prepared)
}

fn build_download_result(
    saved_path: PathBuf,
    mappings: Vec<OSSLocalPathMapping>,
    total_items: usize,
) -> OSSDownloadResult {
    OSSDownloadResult {
        saved_path: saved_path.to_string_lossy().to_string(),
        mappings,
        total_items,
    }
}

async fn download_prepared_markdowns(
    prepared_markdowns: Vec<(String, String, Vec<(String, String)>)>,
    selected_prefix: &str,
    root_prefix: &str,
    download_root: &Path,
    oss_config: &OSSConfig,
    app_handle: &tauri::AppHandle,
    task_id: &str,
) -> Result<OSSDownloadResult, OSSError> {
    let total_items = prepared_markdowns
        .iter()
        .map(|(_, _, image_refs)| image_refs.len() + 1)
        .sum::<usize>();
    let mut completed_items = 0usize;
    let mut mappings = Vec::new();

    emit_download_progress(app_handle, task_id, "准备下载", 0, total_items, "preparing");

    for (markdown_key, markdown_content, image_refs) in prepared_markdowns {
        let relative_markdown_path = build_relative_object_path(&markdown_key, selected_prefix);
        let local_markdown_path = download_root.join(&relative_markdown_path);
        let local_markdown_dir = local_markdown_path
            .parent()
            .ok_or_else(|| OSSError::InvalidPath("无效的 Markdown 保存路径".to_string()))?;
        fs::create_dir_all(local_markdown_dir)?;

        let mut image_mappings = HashMap::new();
        for (image_path, image_key) in image_refs {
            let image_bytes = read_oss_object_bytes(oss_config, &image_key).await?;
            let local_asset_relative_path = build_local_asset_relative_path(
                local_markdown_path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("document.md"),
                &image_key,
                selected_prefix,
                root_prefix,
            );
            let local_asset_path = local_markdown_dir.join(&local_asset_relative_path);
            if let Some(parent_dir) = local_asset_path.parent() {
                fs::create_dir_all(parent_dir)?;
            }
            fs::write(&local_asset_path, image_bytes)?;
            image_mappings.insert(image_path, path_to_markdown_link(&local_asset_relative_path));
            mappings.push(OSSLocalPathMapping {
                object_key: image_key.clone(),
                local_path: local_asset_path.to_string_lossy().to_string(),
            });
            completed_items += 1;
            emit_download_progress(
                app_handle,
                task_id,
                &image_key,
                completed_items,
                total_items,
                "downloading",
            );
        }

        let rewritten_markdown = replace_markdown_image_paths(&markdown_content, &image_mappings);
        fs::write(&local_markdown_path, rewritten_markdown)?;
        mappings.push(OSSLocalPathMapping {
            object_key: markdown_key.clone(),
            local_path: local_markdown_path.to_string_lossy().to_string(),
        });
        completed_items += 1;
        emit_download_progress(
            app_handle,
            task_id,
            &markdown_key,
            completed_items,
            total_items,
            "downloading",
        );
    }

    emit_download_progress(app_handle, task_id, "下载完成", total_items, total_items, "completed");
    Ok(build_download_result(
        download_root.to_path_buf(),
        mappings,
        total_items,
    ))
}

// 根据文件扩展名获取Content-Type
fn get_content_type(file_path: &str) -> &'static str {
    let extension = Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    
    match extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "md" | "markdown" => "text/markdown",
        "txt" => "text/plain",
        "html" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        "json" => "application/json",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        _ => DEFAULT_CONTENT_TYPE,
    }
}

// 生成OSS签名
fn generate_oss_signature(
    method: &str,
    content_md5: &str,
    content_type: &str,
    date: &str,
    canonicalized_oss_headers: &str,
    canonicalized_resource: &str,
    access_key_secret: &str,
) -> String {
    let string_to_sign = format!(
        "{}\n{}\n{}\n{}\n{}{}",
        method, content_md5, content_type, date, canonicalized_oss_headers, canonicalized_resource
    );
    let mut mac = Hmac::<Sha1>::new_from_slice(access_key_secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(string_to_sign.as_bytes());
    general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

// 通用OSS上传函数
async fn upload_to_oss(
    data: Vec<u8>,
    oss_key: &str,
    content_type: &str,
    oss_config: &OSSConfig,
) -> Result<String, OSSError> {
    // 验证配置
    oss_config.validate()?;

    let endpoint = oss_config.get_endpoint();
    let url = format!("{}/{}", endpoint, oss_key);

    // 准备请求头
    let date = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();
    let canonicalized_resource = format!("/{}/{}", oss_config.bucket, oss_key);

    // 构建Authorization头
    let authorization = build_authorization_header(
        "PUT",
        content_type,
        &date,
        "",
        &canonicalized_resource,
        &oss_config.access_key_id,
        &oss_config.access_key_secret,
    );

    // 发送请求
    let client = Client::new();
    let response = client
        .put(&url)
        .header("Authorization", authorization)
        .header("Content-Type", content_type)
        .header("Date", date)
        .header("Content-Length", data.len())
        .body(data)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(url)
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(OSSError::UploadFailed(error_text))
    }
}

async fn copy_oss_object(
    source_key: &str,
    target_key: &str,
    oss_config: &OSSConfig,
) -> Result<(), OSSError> {
    oss_config.validate()?;

    let endpoint = oss_config.get_endpoint();
    let url = build_oss_object_url(&endpoint, target_key);
    let date = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();
    let canonicalized_resource = format!("/{}/{}", oss_config.bucket, target_key);
    let copy_source = encode_oss_copy_source(&oss_config.bucket, source_key);
    // OSS 复制请求需要把 x-oss-copy-source 纳入签名串，否则会触发 SignatureDoesNotMatch。
    let canonicalized_oss_headers = format!("x-oss-copy-source:{}\n", copy_source);
    let authorization = build_authorization_header(
        "PUT",
        "",
        &date,
        &canonicalized_oss_headers,
        &canonicalized_resource,
        &oss_config.access_key_id,
        &oss_config.access_key_secret,
    );

    let response = Client::new()
        .put(&url)
        .header("Authorization", authorization)
        .header("Date", date)
        .header("Content-Length", 0)
        .header("x-oss-copy-source", copy_source)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(OSSError::UploadFailed(error_text))
    }
}

async fn delete_oss_object(object_key: &str, oss_config: &OSSConfig) -> Result<(), OSSError> {
    oss_config.validate()?;

    let endpoint = oss_config.get_endpoint();
    let url = build_oss_object_url(&endpoint, object_key);
    let date = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();
    let canonicalized_resource = format!("/{}/{}", oss_config.bucket, object_key);
    let authorization = build_authorization_header(
        "DELETE",
        "",
        &date,
        "",
        &canonicalized_resource,
        &oss_config.access_key_id,
        &oss_config.access_key_secret,
    );

    let response = Client::new()
        .delete(&url)
        .header("Authorization", authorization)
        .header("Date", date)
        .send()
        .await?;

    if response.status().is_success() || response.status().as_u16() == 404 {
        Ok(())
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(OSSError::UploadFailed(error_text))
    }
}

fn oss_object_key_from_url(oss_url: &str, oss_config: &OSSConfig) -> Result<String, OSSError> {
    let endpoint = oss_config.get_endpoint();
    if let Some(stripped) = oss_url.strip_prefix(&format!("{}/", endpoint.trim_end_matches('/'))) {
        return Ok(stripped.trim_start_matches('/').to_string());
    }

    let parsed = reqwest::Url::parse(oss_url)
        .map_err(|error| OSSError::InvalidPath(format!("无效的 OSS URL：{error}")))?;
    let object_key = parsed.path().trim_start_matches('/').to_string();
    if object_key.is_empty() {
        return Err(OSSError::InvalidPath("无法从 OSS URL 中解析对象路径".to_string()));
    }

    Ok(object_key)
}

#[tauri::command]
pub async fn copy_oss_environment_folder(
    oss_config: OSSConfig,
    source_env: String,
    target_env: String,
) -> Result<usize, String> {
    let result: Result<usize, OSSError> = async {
        oss_config.validate()?;

        let source_prefix = normalize_oss_prefix(&join_oss_path(&oss_config.get_oss_dir(), &source_env));
        let target_prefix = normalize_oss_prefix(&join_oss_path(&oss_config.get_oss_dir(), &target_env));

        if source_prefix.is_empty() || target_prefix.is_empty() {
            return Err(OSSError::InvalidPath("环境目录不能为空".to_string()));
        }

        if source_prefix == target_prefix {
            return Err(OSSError::InvalidPath("源环境和目标环境不能相同".to_string()));
        }

        let object_keys = collect_object_keys(&source_prefix, &oss_config).await?;
        if object_keys.is_empty() {
            return Err(OSSError::InvalidPath(format!(
                "{} 环境下没有可复制的文件",
                source_env
            )));
        }

        for source_key in &object_keys {
            let relative_path = source_key
                .strip_prefix(&source_prefix)
                .ok_or_else(|| OSSError::InvalidPath("无法计算环境复制路径".to_string()))?;
            let target_key = format!("{}{}", target_prefix, relative_path);
            copy_oss_object(source_key, &target_key, &oss_config).await?;
        }

        Ok(object_keys.len())
    }
    .await;

    result.map_err(|e: OSSError| e.to_string())
}

#[tauri::command]
pub async fn delete_oss_objects(
    oss_urls: Vec<String>,
    oss_config: OSSConfig,
) -> Result<usize, String> {
    let result: Result<usize, OSSError> = async {
        oss_config.validate()?;

        let mut deleted_count = 0usize;
        for oss_url in oss_urls {
            let object_key = oss_object_key_from_url(&oss_url, &oss_config)?;
            delete_oss_object(&object_key, &oss_config).await?;
            deleted_count += 1;
        }

        Ok(deleted_count)
    }
    .await;

    match result {
        Ok(deleted_count) => Ok(deleted_count),
        Err(error) => Err(error.to_string()),
    }
}

// 上传图片到阿里云OSS
#[tauri::command]
pub async fn upload_image_to_oss(
    image_path: String,
    oss_config: OSSConfig,
) -> Result<ImageUploadResult, String> {
    let result = async {
        // 验证文件路径
        let path = Path::new(&image_path);
        if !path.exists() {
            return Err(OSSError::InvalidPath(format!("File not found: {}", image_path)));
        }

        // 读取图片文件
        let image_data = std::fs::read(&image_path)?;
        
        // 生成文件名
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| OSSError::InvalidPath("Invalid file name".to_string()))?;

        let oss_dir = oss_config.get_oss_dir();
        let oss_key = build_image_object_key(&oss_dir, file_name);
        
        // 获取内容类型
        let content_type = get_content_type(&image_path);
        
        // 上传到OSS
        let oss_url = upload_to_oss(image_data, &oss_key, content_type, &oss_config).await?;
        
        Ok(ImageUploadResult {
            original_path: image_path,
            oss_url,
        })
    }.await;
    
    result.map_err(|e| e.to_string())
}

// 上传文件到OSS
#[tauri::command]
pub async fn upload_file_to_oss(
    file_path: String,
    oss_config: OSSConfig,
) -> Result<String, String> {
    let result = async {
        // 验证文件路径
        let path = Path::new(&file_path);
        if !path.exists() {
            return Err(OSSError::InvalidPath(format!("File not found: {}", file_path)));
        }

        // 读取文件
        let file_content = std::fs::read(&file_path)?;
        
        // 生成文件名
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| OSSError::InvalidPath("Invalid file name".to_string()))?;

        let oss_dir = oss_config.get_oss_dir();
        let oss_key = format!("{}/{}", oss_dir, file_name);
        
        // 获取内容类型
        let content_type = get_content_type(&file_path);
        
        // 上传到OSS
        upload_to_oss(file_content, &oss_key, content_type, &oss_config).await
    }.await;
    
    result.map_err(|e| e.to_string())
}

// 上传内容到OSS
#[tauri::command]
pub async fn upload_content_to_oss(
    content: String,
    oss_config: OSSConfig,
    file_name: String,
) -> Result<String, String> {
    let result = async {
        // 验证文件名
        if file_name.is_empty() {
            return Err(OSSError::InvalidPath("File name cannot be empty".to_string()));
        }

        let oss_dir = oss_config.get_oss_dir();
        let oss_key = format!("{}/{}", oss_dir, file_name);
        
        // 获取内容类型
        let content_type = get_content_type(&file_name);
        
        // 上传到OSS
        upload_to_oss(content.into_bytes(), &oss_key, content_type, &oss_config).await
    }.await;
    
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn copy_oss_node(
    oss_config: OSSConfig,
    source_path: String,
    target_dir: String,
    node_type: String,
) -> Result<usize, String> {
    let result = async {
        oss_config.validate()?;

        let normalized_node_type = node_type.trim().to_lowercase();
        let normalized_target_dir = normalize_oss_prefix(&target_dir);
        if normalized_target_dir.is_empty() {
            return Err(OSSError::InvalidPath("目标目录不能为空".to_string()));
        }

        match normalized_node_type.as_str() {
            "file" => {
                let source_key = normalize_oss_object_path(&source_path);
                let target_key = join_oss_path(
                    normalized_target_dir.trim_end_matches('/'),
                    &extract_node_name(&source_key),
                );
                if source_key == target_key {
                    return Err(OSSError::InvalidPath("不能粘贴到当前文件所在位置".to_string()));
                }
                copy_oss_object(&source_key, &target_key, &oss_config).await?;
                Ok(1usize)
            }
            "directory" => {
                let source_prefix = normalize_oss_prefix(&source_path);
                if source_prefix.is_empty() {
                    return Err(OSSError::InvalidPath("源目录不能为空".to_string()));
                }

                let target_root_prefix = normalize_oss_prefix(&join_oss_path(
                    normalized_target_dir.trim_end_matches('/'),
                    &extract_node_name(source_prefix.trim_end_matches('/')),
                ));

                if source_prefix == target_root_prefix {
                    return Err(OSSError::InvalidPath("不能粘贴到当前目录本身".to_string()));
                }

                if target_root_prefix.starts_with(&source_prefix) {
                    return Err(OSSError::InvalidPath("不能粘贴到当前目录的子目录中".to_string()));
                }

                let object_keys = collect_object_keys(&source_prefix, &oss_config).await?;
                if object_keys.is_empty() {
                    return Err(OSSError::InvalidPath("源目录下没有可复制的文件".to_string()));
                }

                for source_key in &object_keys {
                    let relative_path = source_key.strip_prefix(&source_prefix).ok_or_else(|| {
                        OSSError::InvalidPath("无法计算目录复制路径".to_string())
                    })?;
                    let target_key = format!("{}{}", target_root_prefix, relative_path);
                    copy_oss_object(source_key, &target_key, &oss_config).await?;
                }

                Ok(object_keys.len())
            }
            _ => Err(OSSError::InvalidPath("仅支持复制文件或目录".to_string())),
        }
    }
    .await;

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_oss_directory_tree(
    oss_config: OSSConfig,
    prefix: Option<String>,
) -> Result<Vec<OSSTreeNode>, String> {
    let result = async {
        oss_config.validate()?;
        let target_prefix = prefix
            .map(|value| normalize_oss_prefix(&value))
            .unwrap_or_else(|| normalize_oss_prefix(&oss_config.get_oss_dir()));
        list_oss_children(&target_prefix, &oss_config).await
    }
    .await;

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_oss_file_content(
    oss_config: OSSConfig,
    object_key: String,
) -> Result<OSSFileContentResult, String> {
    let result = async {
        oss_config.validate()?;
        if !is_text_key(&object_key) {
            return Err(OSSError::ObjectReadFailed("当前文件不是可预览的文本文件".to_string()));
        }
        let content = read_oss_object_text(&oss_config, &object_key).await?;
        Ok::<OSSFileContentResult, OSSError>(OSSFileContentResult {
            file_name: extract_node_name(&object_key),
            preview_content: build_markdown_preview_content(&content, &object_key, &oss_config),
            content_type: get_text_content_type(&object_key),
            content,
            file_path: object_key,
        })
    }
    .await;

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_oss_markdown_directory(
    app_handle: tauri::AppHandle,
    oss_config: OSSConfig,
    prefix: String,
    target_dir: String,
    task_id: String,
) -> Result<OSSDownloadResult, String> {
    let result = async {
        oss_config.validate()?;
        let selected_prefix = normalize_oss_prefix(&prefix);
        let root_prefix = normalize_oss_prefix(&oss_config.get_oss_dir());
        let download_root = Path::new(&target_dir).join(extract_node_name(&selected_prefix));
        fs::create_dir_all(&download_root)?;

        let markdown_keys = collect_markdown_keys(&selected_prefix, &oss_config).await?;
        if markdown_keys.is_empty() {
            return Err(OSSError::InvalidPath("当前目录下没有 Markdown 文件".to_string()));
        }
        let prepared_markdowns = prepare_markdown_downloads(markdown_keys, &oss_config).await?;
        download_prepared_markdowns(
            prepared_markdowns,
            &selected_prefix,
            &root_prefix,
            &download_root,
            &oss_config,
            &app_handle,
            &task_id,
        )
        .await
    }
    .await;

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_oss_markdown_file(
    app_handle: tauri::AppHandle,
    oss_config: OSSConfig,
    object_key: String,
    target_dir: String,
    task_id: String,
) -> Result<OSSDownloadResult, String> {
    let result = async {
        oss_config.validate()?;
        let markdown_keys = collect_single_markdown_key(&object_key, &oss_config).await?;
        let selected_prefix = Path::new(&object_key)
            .parent()
            .map(|parent| parent.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let selected_prefix = normalize_oss_prefix(&selected_prefix);
        let root_prefix = normalize_oss_prefix(&oss_config.get_oss_dir());
        let prepared_markdowns = prepare_markdown_downloads(markdown_keys, &oss_config).await?;
        download_prepared_markdowns(
            prepared_markdowns,
            &selected_prefix,
            &root_prefix,
            Path::new(&target_dir),
            &oss_config,
            &app_handle,
            &task_id,
        )
        .await
    }
    .await;

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_local_path(path: String) -> Result<(), String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err("本地文件不存在，请先执行下载".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let status = if target_path.is_dir() {
            Command::new("explorer").arg(&path).status()
        } else {
            Command::new("explorer")
                .args(["/select,", &path])
                .status()
        }
        .map_err(|error| error.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("无法在资源管理器中定位文件".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let parent_dir = if target_path.is_dir() {
            target_path.to_path_buf()
        } else {
            target_path
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| target_path.to_path_buf())
        };
        Command::new("xdg-open")
            .arg(parent_dir)
            .status()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

// 自定义错误类型
#[derive(Error, Debug)]
pub enum OSSError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
    #[error("OSS upload failed: {0}")]
    UploadFailed(String),
    #[error("OSS object read failed: {0}")]
    ObjectReadFailed(String),
    #[error("OSS list failed: {0}")]
    ListFailed(String),
    #[error("OSS response parse failed: {0}")]
    ResponseParse(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

// 常量定义
const DEFAULT_OSS_DIR: &str = "static";
const DEFAULT_CONTENT_TYPE: &str = "application/octet-stream";
