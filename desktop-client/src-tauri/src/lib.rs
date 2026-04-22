mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::load_workspace_snapshot,
            commands::run_playground_command,
            commands::run_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ExecGo Playground desktop app");
}
