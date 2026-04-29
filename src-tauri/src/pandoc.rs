use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct PandocResult {
    pub success: bool,
    pub markdown: String,
    pub error: Option<String>,
    pub base_dir: Option<String>,
}

/// 检查 pandoc 是否可用
#[tauri::command]
pub async fn check_pandoc(_app_handle: tauri::AppHandle) -> Result<bool, String> {
    let shell = _app_handle.shell();
    let output = shell
        .command("pandoc")
        .arg("--version")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.status.success())
}

// 移除Markdown中图片的属性
fn remove_image_properties(content: String) -> Result<String, String> {
    let re = Regex::new(
        r"(?x)
        (![\[^\]]*\])   # 图片描述部分
        (\([^)]+\))     # 图片路径部分
        \s*             # 可选空白
        \{              # 开始的花括号
        [^}]*width=[^}]+ # 匹配包含 width= 的属性
        [^}]*           # 其他属性
        \}              # 结束的花括号
        ",
    )
    .expect("无效的正则表达式");
    let cleaned_markdown = re.replace_all(&content, |caps: &regex::Captures| {
        format!("{}{}", &caps[1], &caps[2])
    });
    Ok(cleaned_markdown.to_string())
}

fn get_word_input_format(file_path: &str) -> &'static str {
    match Path::new(file_path)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "doc" => "doc",
        _ => "docx",
    }
}

pub async fn convert_word_file(
    app_handle: tauri::AppHandle,
    file_path: &str,
    cache_path: &str,
) -> Result<PandocResult, String> {
    let file_stem = Path::new(file_path)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("document");
    let base_dir = if cache_path.is_empty() {
        std::env::temp_dir()
    } else {
        Path::new(cache_path).to_path_buf()
    };
    let temp_dir = base_dir
        .join("guide_tools_media")
        .join(format!("{}_{}", file_stem, chrono::Utc::now().timestamp_millis()));
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let extract_media_arg = format!("--extract-media={}", temp_dir.display());
    let input_format = get_word_input_format(file_path);
    let shell = app_handle.shell();
    let output = shell
        .command("pandoc")
        .args([
            file_path,
            "-f",
            input_format,
            "-t",
            "markdown",
            "--wrap=none",
            &extract_media_arg,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let markdown = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;

        Ok(PandocResult {
            success: true,
            markdown: remove_image_properties(markdown)?,
            error: None,
            base_dir: Some(base_dir.to_string_lossy().to_string()),
        })
    } else {
        let error =
            String::from_utf8(output.stderr).unwrap_or_else(|_| "Unknown error".to_string());

        Ok(PandocResult {
            success: false,
            markdown: String::new(),
            error: Some(error),
            base_dir: None,
        })
    }
}

#[tauri::command]
pub async fn convert_word_to_markdown(
    app_handle: tauri::AppHandle,
    file_path: String,
    cache_path: String,
) -> Result<PandocResult, String> {
    convert_word_file(app_handle, &file_path, &cache_path).await
}
