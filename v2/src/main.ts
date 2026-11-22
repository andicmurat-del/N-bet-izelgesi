import "./stil.css";
import { mount } from "svelte";
import App from "./App.svelte";
import Kapi from "./ui/klasor/Kapi.svelte";
import { klasorKipi } from "./veri/saklama";

// ortak klasör kipinde (masaüstü uygulaması ya da tarayıcıda seçilince) önce giriş ekranı
mount(klasorKipi ? Kapi : App, { target: document.getElementById("uygulama")! });
