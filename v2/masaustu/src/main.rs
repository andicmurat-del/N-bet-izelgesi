// Masaüstü uygulaması (Windows): programın kendisi (dist/index.html) bu dosyanın içine gömülüdür, internet gerekmez.
// Bu taraf yalnız dosya işlerini yapar: kullanıcının seçtiği ortak klasöre (ör. \\sunucu\eczane) şifreli kayıtları okur
// ve yazar. Şifreleme, giriş ve yetki programın içinde (src/veri/klasor/) yapılır; burada veri açık hâliyle hiç yoktur.
//
// Güvenlik: yalnız kullanıcının seçtiği (ya da yolunu yazdığı) klasörlerde çalışılır; yol parçaları yalnız harf, rakam,
// "-", "_", "." içerebilir ("..", sürücü harfi, ters bölü yok): seçilen klasörün dışına çıkılamaz.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;

/// kullanıcının seçtiği klasörler (oturum boyunca)
#[derive(Default)]
struct Izinli(Mutex<HashSet<PathBuf>>);
/// kapatma isteği bir kez programa iletilir (bekleyen değişiklikler yazılsın); ikincisinde pencere kapanır
#[derive(Default)]
struct Kapanis(AtomicBool);

#[derive(Serialize)]
struct Bilgi {
    z: f64,
    boyut: u64,
}
#[derive(Serialize)]
struct Oge {
    ad: String,
    klasor: bool,
    z: f64,
    boyut: u64,
}

fn hata(e: std::io::Error) -> String {
    match e.kind() {
        ErrorKind::PermissionDenied => format!("Klasöre erişim izni yok ({e})."),
        _ => e.to_string(),
    }
}
fn kok_al(izin: &State<Izinli>, kok: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(kok);
    if izin.0.lock().map_err(|e| e.to_string())?.contains(&p) {
        Ok(p)
    } else {
        Err("Bu klasör programda açılmadı.".into())
    }
}
fn tam_yol(kok: &Path, yol: &str) -> Result<PathBuf, String> {
    let mut p = kok.to_path_buf();
    if yol.is_empty() {
        return Ok(p);
    }
    for s in yol.split('/') {
        let gecerli = !s.is_empty()
            && s != "."
            && s != ".."
            && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
        if !gecerli {
            return Err(format!("Geçersiz dosya yolu: {yol}"));
        }
        p.push(s);
    }
    Ok(p)
}
fn ms(t: std::io::Result<SystemTime>) -> f64 {
    t.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}
fn rastgele() -> String {
    let n = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{:x}{:x}", n, std::process::id())
}

/// yazılan yolu açar (klasör varsa true)
#[tauri::command]
async fn kok_ekle(izin: State<'_, Izinli>, kok: String) -> Result<bool, String> {
    let p = PathBuf::from(kok.trim());
    if !p.is_absolute() {
        return Err("Klasörün tam yolunu yazın (ör. \\\\sunucu\\eczane ya da D:\\Eczane).".into());
    }
    match fs::metadata(&p) {
        Ok(m) if m.is_dir() => {
            izin.0.lock().map_err(|e| e.to_string())?.insert(p);
            Ok(true)
        }
        Ok(_) => Err("Bu yol bir klasör değil.".into()),
        Err(_) => Ok(false),
    }
}

/// klasör seçme penceresi
#[tauri::command]
async fn klasor_sec<R: Runtime>(app: AppHandle<R>, izin: State<'_, Izinli>, baslik: String) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().set_title(baslik).pick_folder(move |p| {
        let _ = tx.send(p);
    });
    let secilen = rx.recv().map_err(|e| e.to_string())?;
    match secilen.and_then(|p| p.into_path().ok()) {
        Some(p) => {
            let s = p.to_string_lossy().into_owned();
            izin.0.lock().map_err(|e| e.to_string())?.insert(p);
            Ok(Some(s))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn dosya_oku(izin: State<'_, Izinli>, kok: String, yol: String) -> Result<Option<String>, String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    match fs::read_to_string(&p) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(hata(e)),
    }
}

/// dosyayı bütünüyle yazar: önce yanındaki geçici dosyaya, sonra yerine (yarım dosya kalmaz)
#[tauri::command]
async fn dosya_yaz(izin: State<'_, Izinli>, kok: String, yol: String, icerik: String) -> Result<(), String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(hata)?;
    }
    let ad = p.file_name().map(|a| a.to_string_lossy().into_owned()).unwrap_or_default();
    let gecici = p.with_file_name(format!("{ad}.{}.tmp", rastgele()));
    {
        let mut f = fs::File::create(&gecici).map_err(hata)?;
        f.write_all(icerik.as_bytes()).map_err(hata)?;
        f.sync_all().map_err(hata)?;
    }
    // başka bilgisayar o an dosyayı okuyorsa yerine koyma kısa bir süre engellenebilir: birkaç kez denenir
    let mut son = None;
    for _ in 0..40 {
        match fs::rename(&gecici, &p) {
            Ok(()) => return Ok(()),
            Err(e) => {
                son = Some(e);
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
    let _ = fs::remove_file(&gecici);
    Err(son.map(hata).unwrap_or_default())
}

/// dosya yoksa oluşturur (true); varsa dokunmaz (false). Kilit dosyaları için: tek adımda, yarışsız.
#[tauri::command]
async fn dosya_olustur(izin: State<'_, Izinli>, kok: String, yol: String, icerik: String) -> Result<bool, String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(hata)?;
    }
    match fs::OpenOptions::new().write(true).create_new(true).open(&p) {
        Ok(mut f) => {
            f.write_all(icerik.as_bytes()).map_err(hata)?;
            Ok(true)
        }
        Err(e) if e.kind() == ErrorKind::AlreadyExists => Ok(false),
        Err(e) => Err(hata(e)),
    }
}

#[tauri::command]
async fn dosya_sil(izin: State<'_, Izinli>, kok: String, yol: String) -> Result<(), String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    match fs::remove_file(&p) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(hata(e)),
    }
}

/// alt klasörü içindekilerle siler (eski yedekler); kök klasör silinmez
#[tauri::command]
async fn klasor_sil(izin: State<'_, Izinli>, kok: String, yol: String) -> Result<(), String> {
    if yol.is_empty() {
        return Err("Kök klasör silinemez.".into());
    }
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    match fs::remove_dir_all(&p) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(hata(e)),
    }
}

#[tauri::command]
async fn dosya_bilgi(izin: State<'_, Izinli>, kok: String, yol: String) -> Result<Option<Bilgi>, String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    match fs::metadata(&p) {
        Ok(m) if m.is_file() => Ok(Some(Bilgi { z: ms(m.modified()), boyut: m.len() })),
        Ok(_) => Ok(None),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(hata(e)),
    }
}

#[tauri::command]
async fn klasor_listele(izin: State<'_, Izinli>, kok: String, yol: String) -> Result<Vec<Oge>, String> {
    let p = tam_yol(&kok_al(&izin, &kok)?, &yol)?;
    let okunan = match fs::read_dir(&p) {
        Ok(r) => r,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(hata(e)),
    };
    let mut l = vec![];
    for g in okunan.flatten() {
        let Ok(m) = g.metadata() else { continue };
        l.push(Oge {
            ad: g.file_name().to_string_lossy().into_owned(),
            klasor: m.is_dir(),
            z: ms(m.modified()),
            boyut: if m.is_file() { m.len() } else { 0 },
        });
    }
    Ok(l)
}

/// PDF, Excel, yedek dosyası: "Farklı kaydet" penceresi (vazgeçilirse false)
#[tauri::command]
async fn dosya_kaydet<R: Runtime>(app: AppHandle<R>, ad: String, veri: String) -> Result<bool, String> {
    let bayt = base64::engine::general_purpose::STANDARD.decode(veri).map_err(|e| e.to_string())?;
    let (tx, rx) = std::sync::mpsc::channel();
    let mut d = app.dialog().file().set_file_name(&ad);
    if let Some(uzanti) = Path::new(&ad).extension().and_then(|u| u.to_str()) {
        d = d.add_filter(uzanti.to_uppercase(), &[uzanti]);
    }
    d.save_file(move |p| {
        let _ = tx.send(p);
    });
    match rx.recv().map_err(|e| e.to_string())?.and_then(|p| p.into_path().ok()) {
        Some(p) => {
            fs::write(&p, bayt).map_err(hata)?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// program bekleyen değişiklikleri yazdıktan sonra çağırır
#[tauri::command]
fn uygulamayi_kapat<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

/// uygulamanın komutları ve olayları (testler de aynısını kurar)
fn kur<R: Runtime>(b: tauri::Builder<R>) -> tauri::Builder<R> {
    b.plugin(tauri_plugin_dialog::init())
        .manage(Izinli::default())
        .manage(Kapanis::default())
        .invoke_handler(tauri::generate_handler![
            kok_ekle,
            klasor_sec,
            dosya_oku,
            dosya_yaz,
            dosya_olustur,
            dosya_sil,
            klasor_sil,
            dosya_bilgi,
            klasor_listele,
            dosya_kaydet,
            uygulamayi_kapat
        ])
        .on_window_event(|w, e| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                let k = w.state::<Kapanis>();
                if !k.0.swap(true, Ordering::SeqCst) {
                    // önce program bekleyen değişiklikleri ortak klasöre yazsın; yanıt gelmezse 10 saniyede kapanır
                    api.prevent_close();
                    let _ = w.emit("kapanma-istegi", ());
                    let app = w.app_handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(Duration::from_secs(10));
                        app.exit(0);
                    });
                }
            }
        })
}

fn main() {
    kur(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("uygulama başlatılamadı");
}

#[cfg(test)]
mod testler {
    use super::*;
    use serde_json::{json, Value};
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
    use tauri::webview::InvokeRequest;

    fn cagir(w: &tauri::WebviewWindow<MockRuntime>, komut: &str, arg: Value) -> Result<Value, Value> {
        get_ipc_response(
            w,
            InvokeRequest {
                cmd: komut.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" }.parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(arg),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .map(|b| b.deserialize::<Value>().unwrap())
    }

    #[test]
    fn dosya_komutlari() {
        let app = kur(mock_builder()).build(mock_context(noop_assets())).unwrap();
        let w = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
        let kok_yol = std::env::temp_dir().join(format!("eczane-test-{}", rastgele()));
        fs::create_dir_all(&kok_yol).unwrap();
        let kok = kok_yol.to_string_lossy().into_owned();

        // açılmamış klasöre erişilemez; açılınca erişilir
        assert!(cagir(&w, "dosya_oku", json!({"kok": kok, "yol": "kasa.json"})).is_err());
        assert_eq!(cagir(&w, "kok_ekle", json!({"kok": kok})).unwrap(), json!(true));
        assert_eq!(cagir(&w, "kok_ekle", json!({"kok": kok_yol.join("yok").to_string_lossy()})).unwrap(), json!(false));
        assert!(cagir(&w, "kok_ekle", json!({"kok": "goreli/yol"})).is_err());

        assert_eq!(cagir(&w, "dosya_oku", json!({"kok": kok, "yol": "kasa.json"})).unwrap(), Value::Null);
        cagir(&w, "dosya_yaz", json!({"kok": kok, "yol": "veri/nobet/ana.nbk", "icerik": "bir"})).unwrap();
        cagir(&w, "dosya_yaz", json!({"kok": kok, "yol": "veri/nobet/ana.nbk", "icerik": "iki"})).unwrap();
        assert_eq!(cagir(&w, "dosya_oku", json!({"kok": kok, "yol": "veri/nobet/ana.nbk"})).unwrap(), json!("iki"));
        let b = cagir(&w, "dosya_bilgi", json!({"kok": kok, "yol": "veri/nobet/ana.nbk"})).unwrap();
        assert_eq!(b["boyut"], json!(3));
        assert!(b["z"].as_f64().unwrap() > 0.0);

        // kilit: ikinci oluşturma olmaz
        assert_eq!(cagir(&w, "dosya_olustur", json!({"kok": kok, "yol": "veri/nobet/kilit.lock", "icerik": "a"})).unwrap(), json!(true));
        assert_eq!(cagir(&w, "dosya_olustur", json!({"kok": kok, "yol": "veri/nobet/kilit.lock", "icerik": "b"})).unwrap(), json!(false));
        assert_eq!(cagir(&w, "dosya_oku", json!({"kok": kok, "yol": "veri/nobet/kilit.lock"})).unwrap(), json!("a"));

        // liste: geçici dosya kalmaz
        let l = cagir(&w, "klasor_listele", json!({"kok": kok, "yol": "veri/nobet"})).unwrap();
        let mut adlar: Vec<String> = l.as_array().unwrap().iter().map(|o| o["ad"].as_str().unwrap().to_string()).collect();
        adlar.sort();
        assert_eq!(adlar, vec!["ana.nbk", "kilit.lock"]);
        assert_eq!(cagir(&w, "klasor_listele", json!({"kok": kok, "yol": "veri"})).unwrap()[0]["klasor"], json!(true));
        assert_eq!(cagir(&w, "klasor_listele", json!({"kok": kok, "yol": "yok"})).unwrap(), json!([]));

        cagir(&w, "dosya_sil", json!({"kok": kok, "yol": "veri/nobet/kilit.lock"})).unwrap();
        cagir(&w, "dosya_sil", json!({"kok": kok, "yol": "veri/nobet/kilit.lock"})).unwrap();
        assert_eq!(cagir(&w, "dosya_bilgi", json!({"kok": kok, "yol": "veri/nobet/kilit.lock"})).unwrap(), Value::Null);

        // klasörün dışına çıkılamaz
        for y in ["../disari.txt", "veri/../../disari", "a//b", "C:\\x", "..", "veri/./ana", "a\\b", "ş.txt"] {
            assert!(cagir(&w, "dosya_yaz", json!({"kok": kok, "yol": y, "icerik": "x"})).is_err(), "{y}");
        }
        assert!(cagir(&w, "klasor_sil", json!({"kok": kok, "yol": ""})).is_err());
        cagir(&w, "klasor_sil", json!({"kok": kok, "yol": "veri"})).unwrap();
        assert_eq!(cagir(&w, "klasor_listele", json!({"kok": kok, "yol": ""})).unwrap(), json!([]));
        fs::remove_dir_all(&kok_yol).unwrap();
    }
}
