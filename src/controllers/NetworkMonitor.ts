import { HTTPRequest, Page, PageEventObject, ConsoleMessage, Dialog, Frame, Metrics, HTTPResponse, WebWorker } from 'puppeteer'
type TFilter = {
  type: string;
  url: RegExp;
}
interface HTTPRequestWithResolver extends HTTPRequest {
  __resolver?: (value: boolean | PromiseLike<boolean>) => void;
}

export default class NetworkMonitor {
  promises: Promise<boolean>[] = [];
  listening = false;
  page: Page;
  filter: TFilter;
  private filterFrame?: (frame: Frame) => boolean;
  private eventListeners: { [k: string | symbol]: ((event: any) => void)[] } = {};
  constructor(page: Page, filter: TFilter, filterFrame?: (frame: Frame) => boolean) {
    this.page = page;
    this.filter = filter;
    this.filterFrame = filterFrame;
    this.init();
  }
  addPageEventListener<TEvent>(name: keyof PageEventObject, handler: (event: TEvent) => void) {
    if (!(name in this.eventListeners)) {
      this.eventListeners[name] = [];
    }
    this.eventListeners[name].push(handler);
    this.page.on(name, handler as any);
  }
  async init() {

    this.addPageEventListener<HTTPRequest>('request', request => {
      if (this.listening) {
        this.addRequest(request);
      }
    });

    this.addPageEventListener<HTTPRequest>('requestfinished', request => {
      this.finishRequest(request); 
    });
    this.addPageEventListener<HTTPRequest>('requestfailed', request => {
      this.failRequest(request);
    });


  }
  listen() {
    this.listening = true;
  }
  stop() {
    this.listening = false;
  }
  requestPassesFilter(request: HTTPRequest) {
    const frame = request.frame();
    if (this.filterFrame && frame && !this.filterFrame(frame)) {
      return false; 
    }
    return (this.filter.type === '*' || this.filter.type.includes(request.resourceType())) && this.filter.url.test(request.url());
  }
  addRequest(request: HTTPRequest) {
    if (this.requestPassesFilter(request)) {
      this.monitorRequest(request)
    }
  }
  finishRequest(request: HTTPRequest) {
    this.solveRequest(request);
  }
  failRequest(request: HTTPRequest) {
    this.solveRequest(request);
  }
  monitorRequest(request: HTTPRequestWithResolver) {
    //console.log('WAIT FOR...', request.url().slice(0, 512));
    
    this.promises.push(new Promise(resolve => {
      // Store resolve of this promise within the request
      request.__resolver = resolve;
    }));
  }
  solveRequest(request: HTTPRequestWithResolver) {
    //console.log('FINISHED! ', request.url().slice(0, 512));
    // If the request has a __resolver it seems to be recorded by the monitor
    if (request.__resolver) {
      request.__resolver(true);
    }
    // This is a special case that happesn sometime swith data urls because the requestfinish event gets fired before the request event itself (which is a bug in puppeteer as well)
    else if (this.requestPassesFilter(request)) {
      // Try to resolve the promise with a delay and checking it each 5ms until 100ms are over
      const intervalStart = 0;
      const checker = setInterval(() => {
        if (request.__resolver) {
          request.__resolver(true);
          clearInterval(checker);
        }
        if (Date.now() - intervalStart > 100) {
          clearInterval(checker);
        }
      }, 5);
    }
  }
  destroy() {
    for (const eventName in this.eventListeners) {
      for (const eventListener of this.eventListeners[eventName]) {
        this.page.off(eventName as keyof PageEventObject, eventListener);
      }
    }
    
  }

}

/*export default function monitorRequests(page, recognizeInterval = 500) {
  const promises = [];



  return new Promise(resolve => {
    setTimeout(() => {
      Promise.all(promises).then(resolve);
    },recognizeInterval);
  });
}*/