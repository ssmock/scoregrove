import { createApp } from 'vue';
import App from './App.vue';
import './ui/tokens.css';
import './music/smufl.css';
import './shell/print.css';
import { loadMusicFont } from './music/fonts';
import { createEditorStore } from './store/editorStore';
import { editorStoreKey } from './store/injectionKey';

async function bootstrap(): Promise<void> {
  // Glyphs render as tofu until Bravura is ready
  await loadMusicFont();

  const app = createApp(App);

  app.provide(editorStoreKey, createEditorStore());
  app.mount('#app');
}

void bootstrap();
