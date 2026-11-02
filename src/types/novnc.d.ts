// Minimal typings of the noVNC RFB client used by the VPS web console.
declare module '@novnc/novnc' {
  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket,
      options?: { credentials?: { password?: string }; wsProtocols?: string[] },
    );
    scaleViewport: boolean;
    resizeSession: boolean;
    focus(): void;
    disconnect(): void;
    sendCtrlAltDel(): void;
  }
}
