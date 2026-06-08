import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteValidatePage } from './invite-validate';

describe('InviteValidatePage', () => {
  let component: InviteValidatePage;
  let fixture: ComponentFixture<InviteValidatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteValidatePage],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteValidatePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
