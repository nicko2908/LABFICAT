import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import App from "./App.vue";
import { router } from "./router";
import { instalarQuasar } from "./plugins/quasar";

// Los estilos propios van despues de los de Quasar (que se importan dentro de
// plugins/quasar.js) para que las personalizaciones ganen.
import "./styles/main.scss";

const app = createApp(App);

// Pinia con persistencia: los stores que declaren persist: true se guardan
// en localStorage y se recuperan al abrir la aplicacion.
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);
instalarQuasar(app);

app.mount("#app");
