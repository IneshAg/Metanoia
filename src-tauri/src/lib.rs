#[cfg(target_os = "windows")]
#[link(name = "shell32")]
#[link(name = "crypt32")]
#[link(name = "ole32")]
#[link(name = "comdlg32")]
extern "system" {
    fn ShellExecuteW(hwnd: *mut core::ffi::c_void, operation: *const u16, file: *const u16, parameters: *const u16, directory: *const u16, show_cmd: i32) -> isize;
    fn CryptUnprotectData(
        pDataIn: *const DataBlob,
        ppszDataDescr: *mut *mut u16,
        pOptionalEntropy: *const DataBlob,
        pvReserved: *mut core::ffi::c_void,
        pPromptStruct: *mut core::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DataBlob,
    ) -> i32;
    fn LocalFree(hMem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    fn SHBrowseForFolderW(lpbi: *mut BROWSEINFOW) -> *mut core::ffi::c_void;
    fn SHGetPathFromIDListW(pidl: *mut core::ffi::c_void, pszPath: *mut u16) -> i32;
    fn CoTaskMemFree(pv: *mut core::ffi::c_void);
    fn CoInitializeEx(pvReserved: *mut core::ffi::c_void, dwCoInit: u32) -> i32;
    fn CoUninitialize();
    fn CoCreateInstance(
        rclsid: *const GUID,
        pUnkOuter: *mut core::ffi::c_void,
        dwClsContext: u32,
        riid: *const GUID,
        ppv: *mut *mut core::ffi::c_void,
    ) -> i32;
    fn GetOpenFileNameW(lpofn: *mut OPENFILENAMEW) -> i32;
}

#[repr(C)]
struct GUID {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

const CLSID_FILEOPENDIALOG: GUID = GUID {
    data1: 0xdc1c5a9c,
    data2: 0xe88a,
    data3: 0x4dde,
    data4: [0xa5, 0xa1, 0x60, 0xf8, 0x2a, 0x20, 0xae, 0xf7],
};

const IID_IFILEOPENDIALOG: GUID = GUID {
    data1: 0xd57c7288,
    data2: 0xd4ad,
    data3: 0x4768,
    data4: [0xbe, 0x02, 0x9d, 0x96, 0x95, 0x32, 0xd9, 0x60],
};

#[repr(C)]
struct IUnknownVtbl {
    pub QueryInterface: unsafe extern "system" fn(this: *mut core::ffi::c_void, riid: *const GUID, ppvObject: *mut *mut core::ffi::c_void) -> i32,
    pub AddRef: unsafe extern "system" fn(this: *mut core::ffi::c_void) -> u32,
    pub Release: unsafe extern "system" fn(this: *mut core::ffi::c_void) -> u32,
}

#[repr(C)]
struct IModalWindowVtbl {
    pub parent: IUnknownVtbl,
    pub Show: unsafe extern "system" fn(this: *mut core::ffi::c_void, hwndParent: *mut core::ffi::c_void) -> i32,
}

#[repr(C)]
struct IFileDialogVtbl {
    pub modal: IModalWindowVtbl,
    pub SetFileTypes: unsafe extern "system" fn(this: *mut core::ffi::c_void, cFileTypes: u32, rgFilterSpec: *const core::ffi::c_void) -> i32,
    pub SetFileTypeIndex: unsafe extern "system" fn(this: *mut core::ffi::c_void, iFileType: u32) -> i32,
    pub GetFileTypeIndex: unsafe extern "system" fn(this: *mut core::ffi::c_void, piFileType: *mut u32) -> i32,
    pub Advise: unsafe extern "system" fn(this: *mut core::ffi::c_void, pfde: *mut core::ffi::c_void, pdwCookie: *mut u32) -> i32,
    pub Unadvise: unsafe extern "system" fn(this: *mut core::ffi::c_void, dwCookie: u32) -> i32,
    pub SetOptions: unsafe extern "system" fn(this: *mut core::ffi::c_void, fos: u32) -> i32,
    pub GetOptions: unsafe extern "system" fn(this: *mut core::ffi::c_void, pfos: *mut u32) -> i32,
    pub SetDefaultFolder: unsafe extern "system" fn(this: *mut core::ffi::c_void, psi: *mut core::ffi::c_void) -> i32,
    pub SetFolder: unsafe extern "system" fn(this: *mut core::ffi::c_void, psi: *mut core::ffi::c_void) -> i32,
    pub GetFolder: unsafe extern "system" fn(this: *mut core::ffi::c_void, ppsi: *mut *mut core::ffi::c_void) -> i32,
    pub GetCurrentSelection: unsafe extern "system" fn(this: *mut core::ffi::c_void, ppsi: *mut *mut core::ffi::c_void) -> i32,
    pub SetFileName: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszName: *const u16) -> i32,
    pub GetFileName: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszName: *mut *mut u16) -> i32,
    pub SetTitle: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszTitle: *const u16) -> i32,
    pub SetOkButtonLabel: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszText: *const u16) -> i32,
    pub SetFileNameLabel: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszLabel: *const u16) -> i32,
    pub GetResult: unsafe extern "system" fn(this: *mut core::ffi::c_void, ppsi: *mut *mut core::ffi::c_void) -> i32,
    pub AddPlace: unsafe extern "system" fn(this: *mut core::ffi::c_void, psi: *mut core::ffi::c_void, fdap: u32) -> i32,
    pub SetDefaultExtension: unsafe extern "system" fn(this: *mut core::ffi::c_void, pszDefaultExtension: *const u16) -> i32,
    pub Close: unsafe extern "system" fn(this: *mut core::ffi::c_void, hr: i32) -> i32,
    pub SetClientGuid: unsafe extern "system" fn(this: *mut core::ffi::c_void, pguid: *const GUID) -> i32,
    pub ClearClientData: unsafe extern "system" fn(this: *mut core::ffi::c_void) -> i32,
    pub SetFilter: unsafe extern "system" fn(this: *mut core::ffi::c_void, pFilter: *mut core::ffi::c_void) -> i32,
}

#[repr(C)]
struct IShellItemVtbl {
    pub parent: IUnknownVtbl,
    pub BindToHandler: unsafe extern "system" fn(this: *mut core::ffi::c_void, pbc: *mut core::ffi::c_void, bhid: *const GUID, riid: *const GUID, ppvOut: *mut *mut core::ffi::c_void) -> i32,
    pub GetParent: unsafe extern "system" fn(this: *mut core::ffi::c_void, ppsi: *mut *mut core::ffi::c_void) -> i32,
    pub GetDisplayName: unsafe extern "system" fn(this: *mut core::ffi::c_void, sigdnName: u32, ppszName: *mut *mut u16) -> i32,
    pub GetAttributes: unsafe extern "system" fn(this: *mut core::ffi::c_void, sfgaoMask: u32, psfgaoAttribs: *mut u32) -> i32,
    pub Compare: unsafe extern "system" fn(this: *mut core::ffi::c_void, psi: *mut core::ffi::c_void, hint: u32, piOrder: *mut i32) -> i32,
}

#[repr(C)]
#[allow(non_snake_case)]
struct BROWSEINFOW {
    hwndOwner: *mut core::ffi::c_void,
    pidlRoot: *mut core::ffi::c_void,
    pszDisplayName: *mut u16,
    lpszTitle: *const u16,
    ulFlags: u32,
    lpfn: *mut core::ffi::c_void,
    lParam: isize,
    iImage: i32,
}

#[repr(C)]
#[allow(non_snake_case)]
struct OPENFILENAMEW {
    lStructSize: u32,
    hwndOwner: *mut core::ffi::c_void,
    hInstance: *mut core::ffi::c_void,
    lpstrFilter: *const u16,
    lpstrCustomFilter: *mut u16,
    nMaxCustFilter: u32,
    nFilterIndex: u32,
    lpstrFile: *mut u16,
    nMaxFile: u32,
    lpstrFileTitle: *mut u16,
    nMaxFileTitle: u32,
    lpstrInitialDir: *const u16,
    lpstrTitle: *const u16,
    Flags: u32,
    nFileOffset: u16,
    nFileExtension: u16,
    lpstrDefExt: *const u16,
    lCustData: isize,
    lpfnHook: *mut core::ffi::c_void,
    lpTemplateName: *const u16,
    pvReserved: *mut core::ffi::c_void,
    dwReserved: u32,
    FlagsEx: u32,
}

#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}

#[tauri::command]
fn get_notion_token() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
        let cred_path = std::path::PathBuf::from(local_app_data).join("Metanoia").join("notion-token.bin");
        if !cred_path.exists() {
            return Err("No saved Notion credential found at %LOCALAPPDATA%\\Metanoia\\notion-token.bin".into());
        }
        let cipher_bytes = std::fs::read(&cred_path).map_err(|e| e.to_string())?;
        if cipher_bytes.is_empty() {
            return Err("Notion credential file is empty".into());
        }

        let in_blob = DataBlob {
            cb_data: cipher_bytes.len() as u32,
            pb_data: cipher_bytes.as_ptr() as *mut u8,
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };

        let success = unsafe {
            CryptUnprotectData(
                &in_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                0,
                &mut out_blob,
            )
        };

        if success == 0 || out_blob.pb_data.is_null() {
            return Err("Windows DPAPI failed to decrypt Notion token".into());
        }

        let slice = unsafe { std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize) };
        let token_str = String::from_utf8(slice.to_vec()).map_err(|e| e.to_string())?;
        unsafe { LocalFree(out_blob.pb_data as *mut core::ffi::c_void) };

        Ok(token_str.trim().to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Notion token decryption is supported on Windows".into())
    }
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if url.chars().any(char::is_control) { return Err("Invalid URL.".into()); }
    let trimmed = url.trim();
    let is_valid = trimmed.starts_with("https://") 
        || trimmed.starts_with("http://") 
        || trimmed.starts_with("notion://")
        || trimmed.starts_with("file://")
        || (std::path::Path::new(trimmed).is_absolute() && std::path::Path::new(trimmed).exists());
    if !is_valid { return Err("Only web links, Notion links, or local files can be opened.".into()); }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let operation: Vec<u16> = std::ffi::OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
        let target: Vec<u16> = std::ffi::OsStr::new(trimmed).encode_wide().chain(std::iter::once(0)).collect();
        let result = unsafe { ShellExecuteW(std::ptr::null_mut(), operation.as_ptr(), target.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
        if result <= 32 { return Err("Windows could not open this link or file.".into()); }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("This command is available in the Windows app.".into()) }
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    if path.chars().any(char::is_control) { return Err("Invalid path.".into()); }
    let trimmed = path.trim();
    let p = std::path::Path::new(trimmed);
    if !p.exists() {
        return Err("Path does not exist on disk.".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let operation: Vec<u16> = std::ffi::OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
        let explorer: Vec<u16> = std::ffi::OsStr::new("explorer.exe").encode_wide().chain(std::iter::once(0)).collect();
        let param_str = if p.is_file() {
            format!("/select,\"{}\"", trimmed)
        } else {
            format!("\"{}\"", trimmed)
        };
        let params: Vec<u16> = std::ffi::OsStr::new(&param_str).encode_wide().chain(std::iter::once(0)).collect();

        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                explorer.as_ptr(),
                params.as_ptr(),
                std::ptr::null(),
                1,
            )
        };
        if result <= 32 {
            return Err("Windows could not reveal the path in Explorer.".into());
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("This command is available in the Windows app.".into()) }
}

#[tauri::command]
fn open_notion(url: String) -> Result<(), String> {
    if url.chars().any(char::is_control) { return Err("Invalid Notion link.".into()); }
    let trimmed = url.trim();
    let clean = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("notion://");

    let path_part = if clean.starts_with("app.notion.com/p/") {
        &clean["app.notion.com/p/".len()..]
    } else if clean.starts_with("www.notion.so/") {
        &clean["www.notion.so/".len()..]
    } else if clean.starts_with("notion.so/") {
        &clean["notion.so/".len()..]
    } else {
        clean
    };

    let notion_uri = format!("notion://www.notion.so/{}", path_part);
    let web_uri = format!("https://www.notion.so/{}", path_part);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let operation: Vec<u16> = std::ffi::OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();

        // 1. Direct Notion.exe launch first for seamless, instant open
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let exe_path = std::path::PathBuf::from(local_app_data).join("Programs").join("Notion").join("Notion.exe");
            if exe_path.exists() {
                if let Ok(_) = std::process::Command::new(&exe_path).arg(&notion_uri).spawn() {
                    return Ok(());
                }
            }
        }

        // 2. Protocol handler via ShellExecuteW
        let target: Vec<u16> = std::ffi::OsStr::new(&notion_uri).encode_wide().chain(std::iter::once(0)).collect();
        let result = unsafe { ShellExecuteW(std::ptr::null_mut(), operation.as_ptr(), target.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
        if result > 32 {
            return Ok(());
        }

        // 3. Fallback to web link if desktop Notion failed
        let fallback_target: Vec<u16> = std::ffi::OsStr::new(&web_uri).encode_wide().chain(std::iter::once(0)).collect();
        let fb_res = unsafe { ShellExecuteW(std::ptr::null_mut(), operation.as_ptr(), fallback_target.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
        if fb_res > 32 {
            return Ok(());
        }

        Err("Could not open Notion desktop app.".into())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Notion desktop link is supported on Windows.".into()) }
}

#[tauri::command]
fn scan_folder_videos(folder_path: String) -> Result<String, String> {
    let clean = folder_path.trim().trim_matches('"').trim_matches('\'').trim();
    let mut p = std::path::PathBuf::from(clean);

    // Smart directory resolution: if folder not found as typed, search parent for matching folder or check if file
    if !p.exists() || !p.is_dir() {
        if p.exists() && p.is_file() {
            if let Some(parent) = p.parent() {
                p = parent.to_path_buf();
            }
        } else if let Some(parent) = p.parent() {
            if parent.exists() && parent.is_dir() {
                let target_name = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
                if let Ok(entries) = std::fs::read_dir(parent) {
                    let mut matched = None;
                    for entry in entries.flatten() {
                        let ep = entry.path();
                        if ep.is_dir() {
                            let name = ep.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
                            if name == target_name || name.starts_with(&target_name) || target_name.starts_with(&name) {
                                matched = Some(ep);
                                break;
                            }
                        }
                    }
                    if let Some(m) = matched {
                        p = m;
                    }
                }
            }
        }
    }

    if !p.exists() || !p.is_dir() {
        return Err("Folder does not exist or is not a directory.".into());
    }

    let folder_name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Local Video Course".to_string());

    let clean_resolved = p.to_string_lossy().to_string();

    let video_exts = [
        "mp4", "mkv", "webm", "mov", "avi", "m4v", "wmv", "flv", "mpg", "mpeg", "ts", "m2ts", "ogv", "3gp",
    ];

    let mut videos: Vec<(String, String, String)> = Vec::new();
    let mut dirs_to_visit = vec![p.clone()];

    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(entries) = std::fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if video_exts.iter().any(|&e| e.eq_ignore_ascii_case(ext)) {
                            let title = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "Untitled".to_string());
                            let section = path
                                .parent()
                                .and_then(|parent| parent.strip_prefix(&p).ok())
                                .map(|rel| {
                                    let s = rel.to_string_lossy().to_string();
                                    if s.is_empty() {
                                        "Main".to_string()
                                    } else {
                                        s
                                    }
                                })
                                .unwrap_or_else(|| "Main".to_string());

                            videos.push((title, path.to_string_lossy().to_string(), section));
                        }
                    }
                }
            }
        }
    }

    // Natural alphanumeric sorting function
    fn natural_sort_key(s: &str) -> Vec<(bool, String, u64)> {
        let mut parts = Vec::new();
        let mut cur_num = String::new();
        let mut cur_str = String::new();
        for c in s.chars() {
            if c.is_ascii_digit() {
                if !cur_str.is_empty() {
                    parts.push((false, cur_str.to_lowercase(), 0));
                    cur_str.clear();
                }
                cur_num.push(c);
            } else {
                if !cur_num.is_empty() {
                    let val = cur_num.parse::<u64>().unwrap_or(0);
                    parts.push((true, String::new(), val));
                    cur_num.clear();
                }
                cur_str.push(c);
            }
        }
        if !cur_str.is_empty() {
            parts.push((false, cur_str.to_lowercase(), 0));
        }
        if !cur_num.is_empty() {
            let val = cur_num.parse::<u64>().unwrap_or(0);
            parts.push((true, String::new(), val));
        }
        parts
    }

    videos.sort_by(|a, b| {
        let sec_cmp = natural_sort_key(&a.2).cmp(&natural_sort_key(&b.2));
        if sec_cmp != std::cmp::Ordering::Equal {
            sec_cmp
        } else {
            natural_sort_key(&a.0).cmp(&natural_sort_key(&b.0))
        }
    });

    if videos.is_empty() {
        return Err("No supported video files (.mp4, .mkv, .mov, etc.) were found in this folder.".into());
    }

    let mut json = String::from("{\"title\":");
    json.push_str(&escape_json_str(&folder_name));
    json.push_str(",\"folder\":");
    json.push_str(&escape_json_str(&clean_resolved));
    json.push_str(",\"videos\":[");
    for (i, (t, path, sec)) in videos.iter().enumerate() {
        if i > 0 { json.push(','); }
        json.push_str("{\"title\":");
        json.push_str(&escape_json_str(t));
        json.push_str(",\"sourceUrl\":");
        json.push_str(&escape_json_str(path));
        json.push_str(",\"section\":");
        json.push_str(&escape_json_str(sec));
        json.push('}');
    }
    json.push_str("]}");
    Ok(json)
}

fn escape_json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 32 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        // Execute folder picker in dedicated STA thread for safe, rock-solid COM Apartment threaded execution
        let handle = std::thread::spawn(|| -> Option<String> {
            use std::os::windows::ffi::OsStrExt;
            unsafe {
                let init_hr = CoInitializeEx(std::ptr::null_mut(), 0x2); // COINIT_APARTMENTTHREADED
                let mut dialog: *mut core::ffi::c_void = std::ptr::null_mut();
                let hr = CoCreateInstance(
                    &CLSID_FILEOPENDIALOG,
                    std::ptr::null_mut(),
                    1, // CLSCTX_INPROC_SERVER
                    &IID_IFILEOPENDIALOG,
                    &mut dialog,
                );

                let mut result_path: Option<String> = None;

                if hr >= 0 && !dialog.is_null() {
                    let vtbl = *(dialog as *mut *mut IFileDialogVtbl);
                    let mut options: u32 = 0;
                    let _ = ((*vtbl).GetOptions)(dialog, &mut options);
                    // FOS_PICKFOLDERS (0x20) | FOS_FORCEFILESYSTEM (0x40)
                    let _ = ((*vtbl).SetOptions)(dialog, options | 0x00000020 | 0x00000040);

                    let title: Vec<u16> = std::ffi::OsStr::new("Select Folder with Videos or Audio")
                        .encode_wide()
                        .chain(std::iter::once(0))
                        .collect();
                    let _ = ((*vtbl).SetTitle)(dialog, title.as_ptr());

                    extern "system" {
                        fn GetForegroundWindow() -> *mut core::ffi::c_void;
                    }
                    let hwnd_owner = unsafe { GetForegroundWindow() };
                    let show_hr = ((*vtbl).modal.Show)(dialog, hwnd_owner);
                    if show_hr >= 0 {
                        let mut item: *mut core::ffi::c_void = std::ptr::null_mut();
                        if ((*vtbl).GetResult)(dialog, &mut item) >= 0 && !item.is_null() {
                            let item_vtbl = *(item as *mut *mut IShellItemVtbl);
                            let mut name_ptr: *mut u16 = std::ptr::null_mut();
                            // SIGDN_FILESYSPATH = 0x80058000
                            if ((*item_vtbl).GetDisplayName)(item, 0x80058000, &mut name_ptr) >= 0 && !name_ptr.is_null() {
                                let mut len = 0;
                                while *name_ptr.add(len) != 0 {
                                    len += 1;
                                }
                                let slice = std::slice::from_raw_parts(name_ptr, len);
                                result_path = Some(String::from_utf16_lossy(slice));
                                CoTaskMemFree(name_ptr as *mut core::ffi::c_void);
                            }
                            ((*item_vtbl).parent.Release)(item);
                        }
                    }
                    ((*vtbl).modal.parent.Release)(dialog);
                }

                if init_hr >= 0 {
                    CoUninitialize();
                }
                result_path
            }
        });

        match handle.join() {
            Ok(res) => Ok(res),
            Err(_) => Err("Folder picker thread encountered an issue.".into()),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Folder picker is supported on Windows.".into())
    }
}

#[tauri::command]
fn pick_audio_files() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let mut filter: Vec<u16> = Vec::new();
        let filter_str = "Audio Files (*.mp3;*.m4a;*.wav;*.flac;*.ogg;*.opus;*.aac)\0*.mp3;*.m4a;*.wav;*.flac;*.ogg;*.opus;*.aac\0All Files (*.*)\0*.*\0\0";
        for c in filter_str.encode_utf16() {
            filter.push(c);
        }
        let title: Vec<u16> = std::ffi::OsStr::new("Select Audio Tracks").encode_wide().chain(std::iter::once(0)).collect();

        let mut file_buf = vec![0u16; 65536];

        let mut ofn = OPENFILENAMEW {
            lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
            hwndOwner: unsafe {
                extern "system" { fn GetForegroundWindow() -> *mut core::ffi::c_void; }
                GetForegroundWindow()
            },
            hInstance: std::ptr::null_mut(),
            lpstrFilter: filter.as_ptr(),
            lpstrCustomFilter: std::ptr::null_mut(),
            nMaxCustFilter: 0,
            nFilterIndex: 1,
            lpstrFile: file_buf.as_mut_ptr(),
            nMaxFile: file_buf.len() as u32,
            lpstrFileTitle: std::ptr::null_mut(),
            nMaxFileTitle: 0,
            lpstrInitialDir: std::ptr::null(),
            lpstrTitle: title.as_ptr(),
            Flags: 0x00080204, // OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_ALLOWMULTISELECT
            nFileOffset: 0,
            nFileExtension: 0,
            lpstrDefExt: std::ptr::null(),
            lCustData: 0,
            lpfnHook: std::ptr::null_mut(),
            lpTemplateName: std::ptr::null(),
            pvReserved: std::ptr::null_mut(),
            dwReserved: 0,
            FlagsEx: 0,
        };

        let success = unsafe { GetOpenFileNameW(&mut ofn) };
        if success == 0 {
            return Ok(Vec::new());
        }

        let mut tokens: Vec<String> = Vec::new();
        let mut start = 0;
        for i in 0..file_buf.len() {
            if file_buf[i] == 0 {
                if start == i {
                    break;
                }
                tokens.push(String::from_utf16_lossy(&file_buf[start..i]));
                start = i + 1;
                if start < file_buf.len() && file_buf[start] == 0 {
                    break;
                }
            }
        }

        if tokens.is_empty() {
            return Ok(Vec::new());
        }

        if tokens.len() == 1 {
            return Ok(tokens);
        }

        let dir = &tokens[0];
        let mut results = Vec::new();
        for fname in &tokens[1..] {
            let p = std::path::Path::new(dir).join(fname);
            results.push(p.to_string_lossy().to_string());
        }
        Ok(results)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("File picker is supported on Windows.".into())
    }
}

#[tauri::command]
fn scan_folder_audio(folder_path: String) -> Result<String, String> {
    let p = std::path::Path::new(folder_path.trim());
    if !p.exists() || !p.is_dir() {
        return Err("Folder does not exist or is not a directory.".into());
    }

    let audio_exts = [
        "mp3", "m4a", "wav", "ogg", "flac", "opus", "aac", "wma", "alac", "aiff"
    ];

    let mut tracks: Vec<(String, String)> = Vec::new();
    let mut dirs_to_visit = vec![p.to_path_buf()];

    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(entries) = std::fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if audio_exts.iter().any(|&e| e.eq_ignore_ascii_case(ext)) {
                            let raw_name = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "Untitled Track".to_string());
                            let clean_name = raw_name.replace(['_', '-'], " ");
                            tracks.push((clean_name, path.to_string_lossy().to_string()));
                        }
                    }
                }
            }
        }
    }

    tracks.sort_by(|a, b| a.1.cmp(&b.1));

    if tracks.is_empty() {
        return Err("No supported audio files (.mp3, .m4a, .wav, .flac, etc.) were found in this folder.".into());
    }

    let mut json = String::from(r#"{"folder":"#);
    json.push_str(&escape_json_str(&folder_path));
    json.push_str(r#","tracks":["#);
    for (i, (name, path)) in tracks.iter().enumerate() {
        if i > 0 { json.push(','); }
        json.push_str(r#"{"name":"#);
        json.push_str(&escape_json_str(name));
        json.push_str(r#","path":"#);
        json.push_str(&escape_json_str(path));
        json.push('}');
    }
    json.push_str("]}");
    Ok(json)
}

#[tauri::command]
fn read_media_bytes(path: String) -> Result<Vec<u8>, String> {
    let clean = path.trim().trim_matches('"').trim_matches('\'').trim();
    let p = std::path::Path::new(clean);
    if !p.exists() || !p.is_file() {
        return Err("Media file not found on disk.".into());
    }
    std::fs::read(p).map_err(|e| e.to_string())
}

use tauri::Manager;

#[tauri::command]
fn show_floating_timer(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("floating-timer") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        let win = tauri::WebviewWindowBuilder::new(
            &app,
            "floating-timer",
            tauri::WebviewUrl::App("index.html?overlay=1".into()),
        )
        .title("Metanoia Focus")
        .inner_size(210.0, 56.0)
        .min_inner_size(130.0, 44.0)
        .resizable(true)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_floating_timer(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("floating-timer") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn is_floating_timer_visible(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window("floating-timer") {
        win.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn set_floating_timer_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("floating-timer") {
        win.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_floating_always_on_top(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("floating-timer") {
        win.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_external,
            open_notion,
            show_in_folder,
            scan_folder_videos,
            scan_folder_audio,
            pick_folder,
            pick_audio_files,
            read_media_bytes,
            get_notion_token,
            show_floating_timer,
            hide_floating_timer,
            is_floating_timer_visible,
            set_floating_timer_size,
            set_floating_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("Metanoia could not start");
}
