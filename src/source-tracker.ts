export class SourceTransformTracker<TSourceType extends string> {
  private readonly sourceMap = new Map<string, string>();
  private readonly inFlightSourceMap = new Map<string, Promise<string>>();
  private readonly blobMap = new Map<string, string>();

  public get(sourceType: TSourceType, sourceUrl: string): string | undefined {
    return this.sourceMap.get(this.getSourceKey(sourceType, sourceUrl));
  }

  public set(sourceType: TSourceType, sourceUrl: string, blobUrl: string): void {
    this.sourceMap.set(this.getSourceKey(sourceType, sourceUrl), blobUrl);
    this.blobMap.set(blobUrl, sourceUrl);
  }

  public getSourceUrlByBlob(blobUrl: string): string | undefined {
    return this.blobMap.get(blobUrl);
  }

  public runWithDedup(
    sourceType: TSourceType,
    sourceUrl: string,
    run: () => Promise<string>,
  ): Promise<string> {
    const sourceKey = this.getSourceKey(sourceType, sourceUrl);
    const inFlight = this.inFlightSourceMap.get(sourceKey);
    if (inFlight) {
      return inFlight;
    }

    const task = run();
    this.inFlightSourceMap.set(sourceKey, task);

    return task.finally(() => {
      this.inFlightSourceMap.delete(sourceKey);
    });
  }

  private getSourceKey(sourceType: TSourceType, sourceUrl: string): string {
    return `${sourceType}:${sourceUrl}`;
  }
}
