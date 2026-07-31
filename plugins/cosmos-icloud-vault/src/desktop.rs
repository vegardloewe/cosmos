use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<CosmosIcloudVault<R>> {
    Ok(CosmosIcloudVault(app.clone()))
}

/// Access to the cosmos-icloud-vault APIs.
pub struct CosmosIcloudVault<R: Runtime>(AppHandle<R>);

impl<R: Runtime> CosmosIcloudVault<R> {}
