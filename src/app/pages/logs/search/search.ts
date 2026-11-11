import { Component } from '@angular/core';
import { LogViewerComponent } from '../../../shared/log-viewer/log-viewer';
// crud-template-exempt: analytical log viewer surface registered in app.md Global Table Component Baseline.
@Component({
  selector: 'app-logs-search',
  standalone: true,
  imports: [LogViewerComponent],
  template: '<mns-log-viewer />',
})
export class LogsSearchPage {}
