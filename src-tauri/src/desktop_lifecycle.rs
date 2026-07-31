use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};

const MAIN_WINDOW_LABEL: &str = "main";
const SHOW_MENU_ID: &str = "show-openexpress";
const QUIT_MENU_ID: &str = "quit-openexpress";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayMenuAction {
    ShowWindow,
    Quit,
}

pub fn tray_menu_action(id: &str) -> Option<TrayMenuAction> {
    match id {
        SHOW_MENU_ID => Some(TrayMenuAction::ShowWindow),
        QUIT_MENU_ID => Some(TrayMenuAction::Quit),
        _ => None,
    }
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    create_tray(app)
}

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        log::warn!("main window was not available");
        return;
    };

    if let Err(e) = window.show() {
        log::warn!("failed to show main window: {e}");
    }
    if let Err(e) = window.unminimize() {
        log::warn!("failed to unminimize main window: {e}");
    }
    if let Err(e) = window.set_focus() {
        log::warn!("failed to focus main window: {e}");
    }
}

fn create_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, SHOW_MENU_ID, "Open OpenExpress", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, "Quit OpenExpress", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("openexpress-tray")
        .tooltip("OpenExpress")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match tray_menu_action(event.id().as_ref()) {
            Some(TrayMenuAction::ShowWindow) => show_main_window(app),
            Some(TrayMenuAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if tray_should_show_window(&event) {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

fn tray_should_show_window(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        }
    )
}

#[cfg(test)]
mod tests {
    use super::{tray_menu_action, TrayMenuAction};

    #[test]
    fn maps_known_tray_menu_ids_to_actions() {
        assert_eq!(
            tray_menu_action("show-openexpress"),
            Some(TrayMenuAction::ShowWindow)
        );
        assert_eq!(
            tray_menu_action("quit-openexpress"),
            Some(TrayMenuAction::Quit)
        );
        assert_eq!(tray_menu_action("unknown"), None);
    }
}
