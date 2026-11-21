"use strict";
if (navigator.clipboard) {
  for (const button of document.querySelectorAll("button.copy")) {
    const code = document.getElementById(button.getAttribute("aria-describedby"));
    const label = button.textContent;
    let timer;
    button.hidden = false;
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(code.textContent).then(
        () => {
          button.textContent = button.dataset.copied;
          clearTimeout(timer);
          timer = setTimeout(() => {
            button.textContent = label;
          }, 2000);
        },
        () => getSelection().selectAllChildren(code),
      );
    });
  }
}
