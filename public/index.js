const socket = io();

const redirected = localStorage.getItem("redirected");

if (redirected) {
  socket.emit("game", { redirect: true, status: "failed", username: null });
  localStorage.removeItem("redirected");
}

let clickfirst = true;
document.addEventListener("click", (event) => {
  if (!event.target.closest("#entry_popup") && clickfirst == false) {
    document.querySelector("#entry_popup").style.opacity = 0;
    document.querySelector("#entry_popup").style.display = "none";
    document.querySelector("#play").style.opacity = 1;
    document.querySelector("#play").style.pointerEvents = "all";
  }
  clickfirst = false;
});

document.querySelector("#play").addEventListener("click", (event) => {
  //   window.location.href = window.location.href + "game/";
  //   prompt("Enter your name (doesn't have to be your real name) ;)");]

  document.querySelector("#entry_popup").style.opacity = 1;
  document.querySelector("#entry_popup").style.display = "flex";
  document.querySelector("#play").style.opacity = 0.5;
  document.querySelector("#play").style.pointerEvents = "none";

  clickfirst = true;

  const username_cache = localStorage.getItem("username_cache");

  if (username_cache) {
    document.querySelector("#name_input").value = username_cache;
  }

  document.querySelector("#name_submit").addEventListener("click", () => {
    const name = document.querySelector("#name_input");
    if (name.value.length >= 4) {
      localStorage.setItem("dino_multiplayer_userName", name.value);
      window.location.href = window.location.href + "game/";
    } else alert("Name must be atleast 4 characters long :)");
  });
});
