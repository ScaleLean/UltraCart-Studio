import type { StudioServices } from './services';
import { isSampleSelection } from '../shared/sample';
import { draftScopeSchema, type DraftScope } from '../shared/drafts';
import { builderApplySchema, inspectBuilderContent, type PageBuilderView } from '../shared/page-builder';

export class PageBuilderService {
  constructor(private readonly services: StudioServices) {}

  inspect(raw: DraftScope): PageBuilderView | null {
    const scope = draftScopeSchema.parse(raw);
    const service = isSampleSelection(scope.selection) ? this.services.sampleDrafts : this.services.drafts;
    const document = service.readDocument(scope);
    if (!document) return null;
    return {
      ...inspectBuilderContent(document.content, document.baseline),
      draft: document.draft,
      baselineRoot: inspectBuilderContent(document.baseline).root,
    };
  }

  async apply(raw: unknown): Promise<PageBuilderView> {
    const input = builderApplySchema.parse(raw);
    await this.services.saveStructure(input);
    return this.inspect({ selection: input.selection, path: input.path, slot: input.slot })!;
  }
}
