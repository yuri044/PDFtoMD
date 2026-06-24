# Markdown Basics

Markdown is the plain-text format this tool produces. You write the syntax shown
in the code blocks below, and it renders as formatted text. For the complete
reference, see the [Markdown Guide](https://www.markdownguide.org/basic-syntax/).

---

## Headings

Add `#` signs before your text. The number of `#` symbols sets the heading
level, from 1 (largest) to 6.

```text
# Heading level 1
## Heading level 2
### Heading level 3
```

Renders as:

# Heading level 1
## Heading level 2
### Heading level 3

---

## Bold & Italic

Wrap text in asterisks for emphasis — two for **bold**, one for *italic*, three
for ***both***.

```text
**bold text**
*italic text*
***bold and italic***
```

Renders as: **bold text**, *italic text*, ***bold and italic***.

---

## Blockquotes

Start a line with `>` to quote text.

```text
> This is a quote.
> It can span multiple lines.
```

Renders as:

> This is a quote.
> It can span multiple lines.

---

## Lists

Use `-` for bullets, or `1.` for a numbered list.

```text
- First item
- Second item
- Third item

1. First item
2. Second item
3. Third item
```

Renders as:

- First item
- Second item
- Third item

1. First item
2. Second item
3. Third item

---

## Code

Wrap inline code in single backticks. For a multi-line block, fence it in triple
backticks.

````text
Use the `print()` function.

```
let x = 1;
console.log(x);
```
````

Renders as:

Use the `print()` function.

```
let x = 1;
console.log(x);
```

---

## Horizontal Rule

Put three or more dashes on their own line to draw a divider.

```text
---
```

Renders as a full-width horizontal line.

---

## Links

Put the link text in brackets, then the URL in parentheses.

```text
[Markdown Guide](https://www.markdownguide.org/basic-syntax/)
```

Renders as: [Markdown Guide](https://www.markdownguide.org/basic-syntax/)

---

## Images

Same as a link, with a leading `!`. The text in brackets is the alt text shown
if the image can't load. This tool writes image paths like `images/img-1.png`.

```text
![Alt text](images/img-1.png)
```

Renders the image at that path, inline in the document.
