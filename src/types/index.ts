export type SSRRecord = {
  origins: string[];
  track: {
    opengraph: string[];
    xhr: {
      filter: {
        url: string;
        query: {
          [k: string]: string;
        };
      };
      cacheKey: string;
      defaultVars: string[];
      cacheLifetime: number;
    }[] | null;
  }
}