import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { appConfig } from '../../app.config';
import { MNS_FORM_FIELD_DEFAULTS, provideMnsFormFieldDefaults } from './form-field-defaults';

@Component({
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>Name</mat-label>
      <input matInput />
    </mat-form-field>
  `,
})
class EmptyTextFieldHost {}

describe('Form field defaults', () => {
  it('is provided application-wide', () => {
    expect(appConfig.providers).toContain(
      jasmine.objectContaining({
        provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
        useValue: MNS_FORM_FIELD_DEFAULTS,
      }),
    );
  });

  it('keeps the label of an empty text input on the outline, like select fields', async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyTextFieldHost],
      providers: [provideMnsFormFieldDefaults()],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyTextFieldHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const label = fixture.nativeElement.querySelector('.mdc-floating-label');
    expect(label.classList).toContain('mdc-floating-label--float-above');
    fixture.destroy();
  });
});
