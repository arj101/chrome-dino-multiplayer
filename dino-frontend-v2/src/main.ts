import "./style.css";
import homeURL from "./html/index.html?url";
import { main as gameMain } from "./game";

const app = document.querySelector<HTMLDivElement>("#app")!;
window.fetch(homeURL).then(async (res) => (app.innerHTML = await res.text()));
// const pageCache: Map<string, string> = new Map();

// //loadPage(gameURL, gameMain);

// enum AppPage {
//     Home, Game, NotFound
// }

// const pageURL: Map<AppPage, string> = new Map();
// pageURL.set(AppPage.Home, homeURL)
// pageURL.set(AppPage.Game, gameURL)
// pageURL.set(AppPage.NotFound, notFoundURL)

// const pageFunctions: Map<AppPage, () => Promise<AppPage | void>> = new Map();
// pageFunctions.set(AppPage.Home, homeMain)
// pageFunctions.set(AppPage.Game, gameMain)

// loadPage(AppPage.Home)

// function loadPage(
//     page: AppPage,
//     attachElement?: HTMLElement
// ) {
//     const attachElt = attachElement ? attachElement : app;
//     const path = pageURL.get(page) as string;
//     if (pageCache.has(path)) {
//         const cached = pageCache.get(path);
//         attachElt.innerHTML = cached ? cached : "";
//     }
//     fetch(path)
//         .then((res) => {
//             if (!res.ok) {
//                 loadPage(AppPage.NotFound, attachElt);
//                 return;
//             }
//             res.text()
//                 .then((text) => {
//                     pageCache.set(path, text);
//                     attachElt.innerHTML = text;
//                     console.log(`Loaded page ${path}`);
//                     (pageFunctions.get(page) as () => Promise<AppPage | void>)().then(pageURL => { if (pageURL) loadPage(pageURL, attachElt) })
//                 })
//                 .catch((e) => {
//                     throw e;
//                 });
//         })
//         .catch((e) => {
//             console.warn(`Error loading ${path}: ${e}`);
//             loadPage(AppPage.NotFound, attachElt);
//         });
// }

// export { loadPage as navigateTo, AppPage };

export {};
