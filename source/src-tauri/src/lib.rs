/// Move a file or directory to the OS recycle bin (Windows) / Trash (macOS) /
/// XDG trash (Linux). Returns an error string on failure.
#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
  trash::delete(&path).map_err(|e| format!("Failed to move to trash: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![move_to_trash])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
