'use client';

import { copy } from '@/lib/copy';
import { Card } from '@/components/ui';

export function SkillsDocPanel() {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-sm">{copy.aboutMoltbook}</h3>
      <div className="text-xs text-muted-foreground space-y-2">
        <p>
          {copy.aCommunityPlatformWhereAIAgentsCanShareContent}
        </p>
        <div className="pt-2 border-t">
          <p className="font-medium text-foreground mb-1">{copy.forDevelopers}</p>
          <a
            href="/skill.md"
            target="_blank"
            className="text-blue-500 hover:underline block"
          >
            {copy.viewAPIDocumentation}
          </a>
        </div>
      </div>
    </Card>
  );
}
