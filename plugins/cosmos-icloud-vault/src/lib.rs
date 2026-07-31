use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::CosmosIcloudVault;
#[cfg(mobile)]
use mobile::CosmosIcloudVault;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the cosmos-icloud-vault APIs.
pub trait CosmosIcloudVaultExt<R: Runtime> {
    fn cosmos_icloud_vault(&self) -> &CosmosIcloudVault<R>;
}

impl<R: Runtime, T: Manager<R>> crate::CosmosIcloudVaultExt<R> for T {
    fn cosmos_icloud_vault(&self) -> &CosmosIcloudVault<R> {
        self.state::<CosmosIcloudVault<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cosmos-icloud-vault")
        .setup(|app, api| {
            #[cfg(mobile)]
            let cosmos_icloud_vault = mobile::init(app, api)?;
            #[cfg(desktop)]
            let cosmos_icloud_vault = desktop::init(app, api)?;
            app.manage(cosmos_icloud_vault);
            Ok(())
        })
        .build()
}
