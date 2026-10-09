/** Personalize a generic hello while preserving greetings that already name someone. */
export function personalizeGreeting(introduction: string, firstName?: string): string {
  const name = firstName?.trim().slice(0, 40);
  if (!name) return introduction;
  const generic = /^(\s*)(Hi|Hello|Hey)\b(?:\s+there)?(?:[!.]\s*|,\s*(?=(?:I'm\b|I’m\b|I am\b|my name\b|welcome\b|let's\b|let’s\b|we\b)))/i.exec(introduction);
  if (!generic) return introduction;
  const remainder = introduction.slice(generic[0].length);
  const alreadyNamed = remainder.toLocaleLowerCase().startsWith(name.toLocaleLowerCase())
    && (remainder.length === name.length || /^[\s,.!?:;]/.test(remainder.slice(name.length)));
  if (alreadyNamed) return introduction;
  const end = /[.!?]$/.test(name) ? '' : '.';
  return `${generic[1]}${generic[2]}, ${name}${end}${remainder ? ` ${remainder}` : ''}`;
}
