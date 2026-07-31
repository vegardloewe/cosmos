use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::{VaultDirectory, VaultFile, VaultFileContents, WriteVaultFile};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_cosmos_icloud_vault);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<CosmosIcloudVault<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("", "ExamplePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_cosmos_icloud_vault)?;
    Ok(CosmosIcloudVault(handle))
}

/// Access to the cosmos-icloud-vault APIs.
pub struct CosmosIcloudVault<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> CosmosIcloudVault<R> {
    /// Presents the native Files directory picker. On iOS the plugin retains
    /// the selected folder's security scope for the app session and restores
    /// that scope from a bookmark on subsequent launches.
    pub fn choose_vault(&self) -> crate::Result<VaultDirectory> {
        self.0
            .run_mobile_plugin("chooseVault", ())
            .map_err(Into::into)
    }

    pub fn read_task_store(&self, path: String) -> crate::Result<String> {
        self.0
            .run_mobile_plugin::<VaultFileContents>("readTaskStore", VaultFile { path })
            .map(|file| file.content)
            .map_err(Into::into)
    }

    pub fn write_task_store(&self, path: String, content: String) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("writeTaskStore", WriteVaultFile { path, content })
            .map_err(Into::into)
    }
}
