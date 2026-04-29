// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde_json::json;
use tauri_plugin_store::StoreExt;

// 导入模块
mod pandoc;
mod oss;
mod markdown;

// 重新导出公共类型
pub use pandoc::{PandocResult};
pub use oss::{ImageUploadResult, OSSConfig};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // This loads the store from disk
            let store = app.store("app_data.json")?;

            // Note that values must be serde_json::Value instances,
            // otherwise, they will not be compatible with the JavaScript bindings.
            store.set("a".to_string(), json!("b"));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Pandoc 相关命令
            pandoc::check_pandoc,
            pandoc::convert_word_to_markdown,
            // OSS 相关命令
            oss::upload_image_to_oss,
            oss::upload_file_to_oss,
            oss::upload_content_to_oss,
            oss::copy_oss_environment_folder,
            oss::copy_oss_node,
            oss::list_oss_directory_tree,
            oss::read_oss_file_content,
            oss::download_oss_markdown_directory,
            oss::download_oss_markdown_file,
            oss::reveal_local_path,
            // Markdown 相关命令
            markdown::extract_images_from_markdown,
            markdown::resolve_markdown_image_paths,
            markdown::replace_image_links,
            markdown::list_markdown_directory,
            markdown::list_directory_tree,
            markdown::load_document_content,
            markdown::read_markdown_file,
            markdown::save_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
