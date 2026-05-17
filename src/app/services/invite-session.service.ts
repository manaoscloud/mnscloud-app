import { Injectable } from '@angular/core';
import { InviteSession } from '../models/invite-session.model';

const INVITE_SESSION_KEY = 'mc_invite_session';

@Injectable({ providedIn: 'root' })
export class InviteSessionService {

  set(session: InviteSession) {
    localStorage.setItem(INVITE_SESSION_KEY, JSON.stringify(session));
  }

  get(): InviteSession | null {
    const raw = localStorage.getItem(INVITE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as InviteSession) : null;
  }

  clear() {
    localStorage.removeItem(INVITE_SESSION_KEY);
  }
}