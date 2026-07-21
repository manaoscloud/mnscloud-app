import { NgModule } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';

import { MnsNativeDateAdapter } from './mns-native-date-adapter';

/**
 * Canonical Material date implementation for MNSCloud forms and dialog templates.
 *
 * A standalone component that renders a datepicker inside a MatDialog needs these
 * providers in its own injector as well as at the application root. Import this
 * module instead of MatNativeDateModule everywhere in the app.
 */
@NgModule({
  providers: [
    { provide: DateAdapter, useClass: MnsNativeDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
})
export class MnsDateAdapterModule {}
