import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteValidate } from './invite-validate';

describe('InviteValidate', () => {
  let component: InviteValidate;
  let fixture: ComponentFixture<InviteValidate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteValidate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InviteValidate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
