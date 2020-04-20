﻿import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../logging/logger.service';
import { IFrameService } from './existing-iframe.service';

const IFRAME_FOR_SILENT_RENEW_IDENTIFIER = 'myiFrameForSilentRenew';

@Injectable()
export class SilentRenewService {
    constructor(private loggerService: LoggerService, private iFrameService: IFrameService) {}

    private boundSilentRenewEvent: any;
    private silentRenewResultInternal$ = new BehaviorSubject<any>(null);
    private instanceId = Math.random();

    get silentRenewResult$() {
        return this.silentRenewResultInternal$;
    }

    init() {
        this.getOrCreateIframe();
        // Support authorization via DOM events.
        // Deregister if OidcSecurityService.setupModule is called again by any instance.
        //      We only ever want the latest setup service to be reacting to this event.
        this.boundSilentRenewEvent = this.silentRenewEventHandler.bind(this);

        const boundSilentRenewInitEvent: any = ((e: CustomEvent) => {
            if (e.detail !== this.instanceId) {
                window.removeEventListener('oidc-silent-renew-message', this.boundSilentRenewEvent);
                window.removeEventListener('oidc-silent-renew-init', boundSilentRenewInitEvent);
            }
        }).bind(this);

        window.addEventListener('oidc-silent-renew-init', boundSilentRenewInitEvent, false);
        window.addEventListener('oidc-silent-renew-message', this.boundSilentRenewEvent, false);

        window.dispatchEvent(
            new CustomEvent('oidc-silent-renew-init', {
                detail: this.instanceId,
            })
        );
    }

    private getOrCreateIframe(): HTMLIFrameElement {
        const existingIframe = this.getExistingIframe();

        if (!existingIframe) {
            return this.iFrameService.addIFrameToWindowBody(IFRAME_FOR_SILENT_RENEW_IDENTIFIER);
        }

        return existingIframe;
    }

    private getExistingIframe() {
        return this.iFrameService.getExistingIFrame(IFRAME_FOR_SILENT_RENEW_IDENTIFIER);
    }

    sendAuthorizeReqestUsingSilentRenew(url: string) {
        const sessionIframe = this.getOrCreateIframe();
        this.loggerService.logDebug('sendAuthorizeReqestUsingSilentRenew for URL:' + url);

        return new Observable((observer) => {
            const onLoadHandler = () => {
                sessionIframe.removeEventListener('load', onLoadHandler);
                this.loggerService.logDebug('removed event listener from IFrame');
                observer.next(true);
                observer.complete();
            };
            sessionIframe.addEventListener('load', onLoadHandler);
            sessionIframe.src = url;
        });
    }

    private silentRenewEventHandler(e: CustomEvent) {
        this.loggerService.logDebug('silentRenewEventHandler');
        this.silentRenewResultInternal$.next(e.detail);
    }
}
