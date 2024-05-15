import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import { openDialog, inputDialogLabel, inputDialogTitle, inputbtn, inputvalue } from './global'
import "./index.css";
import App from "./App.vue";
import router from "./router";

const pinia = createPinia();
const app = createApp(App);
async function showInputDialog(title, msg, value) {
    inputDialogLabel.value = msg
    inputDialogTitle.value = title
    openDialog.value = true
    inputvalue.value = value
    inputbtn.value = ''
    return new Promise(r => {
        watch(openDialog, () => {
            if (inputbtn.value) {
                r(inputvalue.value)
            } else { r() }
        })
    })
}
app.provide('showInputDialog', showInputDialog)
app.use(pinia);
app.use(router);
app.mount("#app");
