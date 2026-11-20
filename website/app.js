// Progressive enhancement: all content, links and native details work without JavaScript.
const root = document.documentElement
const toggle = document.querySelector('.theme')
const preference = window.matchMedia('(prefers-color-scheme: dark)')
let selected
try {
  selected = localStorage.getItem('aster-site-theme')
} catch {
  /* Storage may be disabled. */
}
function apply(dark) {
  root.classList.toggle('dark', dark)
  toggle?.setAttribute('aria-pressed', String(dark))
}
apply(selected ? selected === 'dark' : preference.matches)
toggle?.addEventListener('click', () => {
  const dark = !root.classList.contains('dark')
  selected = dark ? 'dark' : 'light'
  apply(dark)
  try {
    localStorage.setItem('aster-site-theme', selected)
  } catch {
    /* In-memory preference still works. */
  }
})
preference.addEventListener('change', (event) => {
  if (!selected) apply(event.matches)
})
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy)?.textContent
    const status = document.getElementById('copy-status')
    if (!text || !status) return
    try {
      await navigator.clipboard.writeText(text)
      status.textContent = button.dataset.success
    } catch {
      status.textContent = button.dataset.failure
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(document.getElementById(button.dataset.copy))
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  })
}
root.classList.add('js')
