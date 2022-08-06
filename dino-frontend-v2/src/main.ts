import "./style.css";
import { main as gameMain } from "./game";

const app = document.querySelector<HTMLDivElement>("#app")!;

const pageCache: Map<string, string> = new Map();

loadPage("game.html", gameMain);

function loadPage(
    page: string,
    onload?: Function | null,
    attachElement?: HTMLElement
) {
    const attachElt = attachElement ? attachElement : app;
    const path = `./src/html/${page}`;
    if (pageCache.has(path)) {
        const cached = pageCache.get(path);
        attachElt.innerHTML = cached ? cached : "";
    }
    fetch(path)
        .then((res) => {
            if (!res.ok) {
                loadPage("404.html", null, attachElt);
                return;
            }
            res.text()
                .then((text) => {
                    pageCache.set(path, text);
                    attachElt.innerHTML = text;
                    console.log(`Loaded page ${path}`);
                    if (typeof onload == "function") onload();
                })
                .catch((e) => {
                    throw e;
                });
        })
        .catch((e) => {
            console.warn(`Error loading ${path}: ${e}`);
            loadPage("404.html", null, attachElt);
        });
}

export { loadPage as navigateTo };
