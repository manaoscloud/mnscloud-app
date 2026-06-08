import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteAcceptPage } from './invite-accept';

describe('InviteAcceptPage', () => {
  let component: InviteAcceptPage;
  let fixture: ComponentFixture<InviteAcceptPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteAcceptPage],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteAcceptPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
