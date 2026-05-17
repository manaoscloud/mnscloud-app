import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

// Bootstrap 100% SPA (sem hydration)
bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));