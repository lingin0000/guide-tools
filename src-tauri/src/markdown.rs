use crate::{oss::ImageUploadResult, pandoc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub key: String,
    pub title: String,
    pub path: String,
    pub node_type: String,
    pub children: Vec<FileTreeNode>,
    pub is_leaf: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryTreeNode {
    pub key: String,
    pub title: String,
    pub path: String,
    pub node_type: String,
    pub children: Vec<DirectoryTreeNode>,
    pub is_leaf: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentContentResult {
    pub content: String,
    pub file_path: String,
    pub file_name: String,
    pub document_type: String,
    pub base_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResolvedImagePath {
    pub original_path: String,
    pub resolved_path: String,
}

fn is_supported_document(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "md" | "markdown" | "doc" | "docx"
    )
}

fn get_document_type(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "md" | "markdown" => Ok("markdown".to_string()),
        "doc" | "docx" => Ok("word".to_string()),
        _ => Err(format!("Unsupported file type: {}", path.display())),
    }
}

fn image_path_regex() -> Regex {
    Regex::new(r"!\[[^\]]*]\(([^)]+)\)").expect("invalid markdown image regex")
}

fn extract_local_image_paths_internal(markdown: &str) -> Vec<String> {
    image_path_regex()
        .captures_iter(markdown)
        .filter_map(|capture| capture.get(1).map(|value| value.as_str().trim().to_string()))
        .filter(|path| !path.starts_with("http://") && !path.starts_with("https://") && !path.starts_with("data:"))
        .collect()
}

fn resolve_relative_path(original_path: &str, base_dir: Option<&str>) -> PathBuf {
    let path = Path::new(original_path);
    if path.is_absolute() {
        return path.to_path_buf();
    }

    if let Some(base_dir) = base_dir {
        return Path::new(base_dir).join(path);
    }

    path.to_path_buf()
}

fn replace_image_links_internal(markdown: String, image_mappings: &[ImageUploadResult]) -> String {
    image_mappings.iter().fold(markdown, |result, mapping| {
        let pattern = format!("]({})", mapping.original_path);
        let replacement = format!("]({})", mapping.oss_url);
        result.replace(&pattern, &replacement)
    })
}

fn build_file_tree(path: &Path) -> Result<Vec<FileTreeNode>, String> {
    let mut directory_entries = Vec::new();
    let mut file_entries = Vec::new();

    for entry_result in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry_result.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if entry_path.is_dir() {
            let children = build_file_tree(&entry_path)?;
            if !children.is_empty() {
                directory_entries.push(FileTreeNode {
                    key: entry_path.to_string_lossy().to_string(),
                    title: file_name,
                    path: entry_path.to_string_lossy().to_string(),
                    node_type: "directory".to_string(),
                    children,
                    is_leaf: false,
                });
            }
            continue;
        }

        if entry_path.is_file() && is_supported_document(&entry_path) {
            let document_type = get_document_type(&entry_path)?;
            file_entries.push(FileTreeNode {
                key: entry_path.to_string_lossy().to_string(),
                title: file_name,
                path: entry_path.to_string_lossy().to_string(),
                node_type: document_type,
                children: Vec::new(),
                is_leaf: true,
            });
        }
    }

    directory_entries.sort_by(|left, right| left.title.cmp(&right.title));
    file_entries.sort_by(|left, right| left.title.cmp(&right.title));
    directory_entries.extend(file_entries);

    Ok(directory_entries)
}

fn build_directory_tree(path: &Path) -> Result<Vec<DirectoryTreeNode>, String> {
    let mut directory_entries = Vec::new();
    let mut file_entries = Vec::new();

    for entry_result in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry_result.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if entry_path.is_dir() {
            directory_entries.push(DirectoryTreeNode {
                key: entry_path.to_string_lossy().to_string(),
                title: file_name,
                path: entry_path.to_string_lossy().to_string(),
                node_type: "directory".to_string(),
                children: build_directory_tree(&entry_path)?,
                is_leaf: false,
            });
            continue;
        }

        if entry_path.is_file() {
            file_entries.push(DirectoryTreeNode {
                key: entry_path.to_string_lossy().to_string(),
                title: file_name,
                path: entry_path.to_string_lossy().to_string(),
                node_type: "file".to_string(),
                children: Vec::new(),
                is_leaf: true,
            });
        }
    }

    directory_entries.sort_by(|left, right| left.title.cmp(&right.title));
    file_entries.sort_by(|left, right| left.title.cmp(&right.title));
    directory_entries.extend(file_entries);

    Ok(directory_entries)
}

#[tauri::command]
pub fn extract_images_from_markdown(markdown: String) -> Result<Vec<String>, String> {
    Ok(extract_local_image_paths_internal(&markdown))
}

#[tauri::command]
pub fn resolve_markdown_image_paths(
    markdown: String,
    base_dir: Option<String>,
) -> Result<Vec<ResolvedImagePath>, String> {
    Ok(extract_local_image_paths_internal(&markdown)
        .into_iter()
        .map(|original_path| ResolvedImagePath {
            resolved_path: resolve_relative_path(&original_path, base_dir.as_deref())
                .to_string_lossy()
                .to_string(),
            original_path,
        })
        .collect())
}

#[tauri::command]
pub fn replace_image_links(
    markdown: String,
    image_mappings: Vec<ImageUploadResult>,
) -> Result<String, String> {
    Ok(replace_image_links_internal(markdown, &image_mappings))
}

#[tauri::command]
pub fn list_markdown_directory(path: String) -> Result<Vec<FileTreeNode>, String> {
    build_file_tree(Path::new(&path))
}

#[tauri::command]
pub fn list_directory_tree(path: String) -> Result<Vec<DirectoryTreeNode>, String> {
    build_directory_tree(Path::new(&path))
}

#[tauri::command]
pub async fn load_document_content(
    app_handle: tauri::AppHandle,
    file_path: String,
    cache_path: String,
) -> Result<DocumentContentResult, String> {
    let path = Path::new(&file_path);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();
    let document_type = get_document_type(path)?;

    if document_type == "markdown" {
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        let base_dir = path.parent().map(|parent| parent.to_string_lossy().to_string());

        return Ok(DocumentContentResult {
            content,
            file_path,
            file_name,
            document_type,
            base_dir,
        });
    }

    let result = pandoc::convert_word_file(app_handle, &file_path, &cache_path).await?;
    if !result.success {
        return Err(result.error.unwrap_or_else(|| "转换失败".to_string()));
    }

    Ok(DocumentContentResult {
        content: result.markdown,
        file_path,
        file_name,
        document_type,
        base_dir: result.base_dir,
    })
}

#[tauri::command]
pub async fn read_markdown_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn save_markdown_file(content: String, file_path: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| format!("Failed to save file: {}", e))?;
    Ok(())
}
