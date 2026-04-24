use tauri::{Emitter, Manager};

/// Move a file or directory to the OS recycle bin (Windows) / Trash (macOS) /
/// XDG trash (Linux). Returns an error string on failure.
#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
  trash::delete(&path).map_err(|e| format!("Failed to move to trash: {e}"))
}

/// Return the .md path the app was launched with, if any. The frontend calls
/// this once on startup to handle "Set as default app → double-click a .md
/// file in Explorer" — Windows passes the file path as argv[1].
#[tauri::command]
fn get_launch_file(state: tauri::State<'_, LaunchFile>) -> Option<String> {
  state.0.lock().ok().and_then(|g| g.clone())
}

/// Shared state holding the .md path we were launched with (if any).
struct LaunchFile(std::sync::Mutex<Option<String>>);

/// Parse process argv looking for a .md / .markdown path. Returns the first
/// match (absolute or relative path the user double-clicked).
fn md_path_from_args(args: impl IntoIterator<Item = String>) -> Option<String> {
  for arg in args.into_iter().skip(1) {
    if arg.starts_with("--") {
      continue;
    }
    let lower = arg.to_lowercase();
    if lower.ends_with(".md") || lower.ends_with(".markdown") {
      return Some(arg);
    }
  }
  None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Capture argv before Tauri starts so we can serve it to the frontend.
  let initial_file = md_path_from_args(std::env::args().collect::<Vec<_>>());

  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      // Another instance was launched (e.g. user double-clicked a second .md).
      // Forward the path to the already-running window and focus it.
      if let Some(path) = md_path_from_args(argv) {
        let _ = app.emit("open-external-file", path);
      }
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.set_focus();
      }
    }))
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(LaunchFile(std::sync::Mutex::new(initial_file)))
    .invoke_handler(tauri::generate_handler![move_to_trash, get_launch_file])
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
