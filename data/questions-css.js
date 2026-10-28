window.QUESTION_BANKS = window.QUESTION_BANKS || {};
window.QUESTION_BANKS.css = [
  {
    id: "css-e-01",
    subject: "css",
    tier: "easy",
    q: "Which CSS symbol is used to select elements by class name?",
    options: [".", "#", "*", "@"],
    answer: 0,
    explain: "A period . prefix denotes a class selector in CSS."
  },
  {
    id: "css-e-02",
    subject: "css",
    tier: "easy",
    q: "Which CSS symbol is used to select an element by its unique id?",
    options: [".", "#", "&", "$"],
    answer: 1,
    explain: "The hash symbol # denotes an ID selector in CSS."
  },
  {
    id: "css-e-03",
    subject: "css",
    tier: "easy",
    q: "Which property adds space inside an element's border, around its content?",
    options: ["margin", "spacing", "padding", "outline"],
    answer: 2,
    explain: "Padding generates internal space between the content and the border."
  },
  {
    id: "css-e-04",
    subject: "css",
    tier: "easy",
    q: "Which CSS property changes the text color of an HTML element?",
    options: ["font-color", "text-color", "background", "color"],
    answer: 3,
    explain: "The color property sets the foreground color of text."
  },
  {
    id: "css-e-05",
    subject: "css",
    tier: "easy",
    q: "Which property adds space outside an element's border, separating it from others?",
    options: ["margin", "padding", "border-spacing", "gap"],
    answer: 0,
    explain: "Margin creates clear space surrounding an element outside its border."
  },
  {
    id: "css-e-06",
    subject: "css",
    tier: "easy",
    q: "Which property controls the size of text in CSS?",
    options: ["text-style", "font-size", "text-size", "font-weight"],
    answer: 1,
    explain: "The font-size property specifies the dimensions of font glyphs."
  },
  {
    id: "css-e-07",
    subject: "css",
    tier: "easy",
    q: "Which display value removes an element entirely from document flow so it is hidden?",
    options: ["opacity: 0", "visibility: hidden", "display: none", "filter: blur()"],
    answer: 2,
    explain: "display: none removes the element from rendering flow entirely."
  },
  {
    id: "css-e-08",
    subject: "css",
    tier: "easy",
    q: "Which CSS selector targets every element on the entire web page?",
    options: ["body", "all", ":root", "*"],
    answer: 3,
    explain: "The asterisk * is the universal selector targeting all elements."
  },
  {
    id: "css-em-01",
    subject: "css",
    tier: "easy-medium",
    q: "What does box-sizing: border-box include within an element's width and height?",
    options: ["Content, padding, and border", "Content only", "Content and margin only", "Margin, border, and padding"],
    answer: 0,
    explain: "border-box includes padding and border within the specified dimensions."
  },
  {
    id: "css-em-02",
    subject: "css",
    tier: "easy-medium",
    q: "Which CSS flexbox property defines the direction of the main axis?",
    options: ["align-items", "flex-direction", "flex-wrap", "justify-content"],
    answer: 1,
    explain: "flex-direction determines whether flex items flow in rows or columns."
  },
  {
    id: "css-em-03",
    subject: "css",
    tier: "easy-medium",
    q: "Which flexbox property aligns items along the main axis?",
    options: ["align-items", "align-content", "justify-content", "place-items"],
    answer: 2,
    explain: "justify-content distributes space between items along the main axis."
  },
  {
    id: "css-em-04",
    subject: "css",
    tier: "easy-medium",
    q: "In margin: 10px 20px;, what does the 20px value represent?",
    options: ["Top margin", "Bottom margin", "Top and bottom margin", "Left and right margin"],
    answer: 3,
    explain: "Two-value margin syntax applies the second value to left and right."
  },
  {
    id: "css-em-05",
    subject: "css",
    tier: "easy-medium",
    q: "Which position value keeps an element fixed relative to the browser viewport?",
    options: ["fixed", "absolute", "relative", "sticky"],
    answer: 0,
    explain: "position: fixed anchors an element relative to the viewport window."
  },
  {
    id: "css-em-06",
    subject: "css",
    tier: "easy-medium",
    q: "Which flexbox property aligns items along the cross axis by default?",
    options: ["justify-content", "align-items", "flex-flow", "align-self"],
    answer: 1,
    explain: "align-items controls child element positioning along the cross axis."
  },
  {
    id: "css-m-01",
    subject: "css",
    tier: "medium",
    q: "Which of the following selectors has the highest specificity?",
    options: ["p.alert", ".btn.btn-primary", "#main-nav", "div p span"],
    answer: 2,
    explain: "ID selectors carry higher specificity than any number of class selectors."
  },
  {
    id: "css-m-02",
    subject: "css",
    tier: "medium",
    q: "What does the selector div > p target?",
    options: ["All p elements inside div", "p elements followed by div", "The first p element on page", "Direct child p elements of div"],
    answer: 3,
    explain: "The child combinator > targets only immediate child elements."
  },
  {
    id: "css-m-03",
    subject: "css",
    tier: "medium",
    q: "If two sibling vertical block margins of 20px and 30px touch, what is the gap?",
    options: ["50px", "10px", "30px", "25px"],
    answer: 2,
    explain: "Adjacent vertical margins collapse into the single largest margin value."
  },
  {
    id: "css-m-04",
    subject: "css",
    tier: "medium",
    q: "What is 1rem relative to in standard CSS?",
    options: ["Parent element font size", "Viewport width", "Nearest container height", "Root element font size"],
    answer: 3,
    explain: "rem units calculate relative to the font-size of the root <html> element."
  },
  {
    id: "css-m-05",
    subject: "css",
    tier: "medium",
    q: "What do the three values in flex: 1 0 auto; represent in order?",
    options: ["grow, shrink, basis", "shrink, grow, basis", "basis, grow, shrink", "grow, basis, shrink"],
    answer: 0,
    explain: "The flex shorthand takes flex-grow, flex-shrink, then flex-basis."
  },
  {
    id: "css-m-06",
    subject: "css",
    tier: "medium",
    q: "An element with position: absolute positions relative to what?",
    options: ["Browser viewport always", "Nearest positioned ancestor", "Immediate parent element", "Document body always"],
    answer: 1,
    explain: "Absolute elements offset against their closest ancestor with non-static position."
  }
];
