window.QUESTION_BANKS = window.QUESTION_BANKS || {};
window.QUESTION_BANKS.python = [
  {
    id: "py-e-01",
    subject: "python",
    tier: "easy",
    q: "What is the data type of the value returned by 5 / 2 in Python 3?",
    options: ["float", "int", "double", "number"],
    answer: 0,
    explain: "Division with / in Python always returns a float even for integers."
  },
  {
    id: "py-e-02",
    subject: "python",
    tier: "easy",
    q: "What is the output of print(2 ** 3) in Python?",
    options: ["6", "8", "5", "9"],
    answer: 1,
    explain: "The ** operator calculates exponentiation, so 2 raised to 3 equals 8."
  },
  {
    id: "py-e-03",
    subject: "python",
    tier: "easy",
    q: "Which of the following creates an empty dictionary in Python?",
    options: ["[]", "set()", "{}", "()"],
    answer: 2,
    explain: "Empty curly braces {} create an empty dict, while [] creates a list."
  },
  {
    id: "py-e-04",
    subject: "python",
    tier: "easy",
    q: "What does the expression 3 in [1, 2, 3, 4] evaluate to?",
    options: ["None", "3", "False", "True"],
    answer: 3,
    explain: "The in operator checks membership and returns True if the item is found."
  },
  {
    id: "py-e-05",
    subject: "python",
    tier: "easy",
    q: "Which keyword is used for 'else if' conditions in Python?",
    options: ["elif", "else if", "elseif", "case"],
    answer: 0,
    explain: "Python uses elif to test multiple conditions sequentially."
  },
  {
    id: "py-e-06",
    subject: "python",
    tier: "easy",
    q: "How many numbers are printed by: for i in range(5): print(i)?",
    options: ["4", "5", "6", "0"],
    answer: 1,
    explain: "range(5) generates integers from 0 through 4, which is 5 numbers."
  },
  {
    id: "py-e-07",
    subject: "python",
    tier: "easy",
    q: "What does len('Python') return?",
    options: ["5", "7", "6", "0"],
    answer: 2,
    explain: "The len function counts the number of characters in the string, which is 6."
  },
  {
    id: "py-e-08",
    subject: "python",
    tier: "easy",
    q: "Which character begins a single-line comment in Python?",
    options: ["//", "/*", "--", "#"],
    answer: 3,
    explain: "Single-line comments in Python begin with the hash symbol #."
  },
  {
    id: "py-em-01",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print([1, 2] + [3, 4])?",
    options: ["[1, 2, 3, 4]", "[4, 6]", "[[1, 2], [3, 4]]", "Error"],
    answer: 0,
    explain: "The + operator concatenates two lists into a single combined list."
  },
  {
    id: "py-em-02",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print('hello'[1:4])?",
    options: ["hel", "ell", "ello", "he"],
    answer: 1,
    explain: "Slice 1:4 takes characters from index 1 up to but not including index 4."
  },
  {
    id: "py-em-03",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(17 // 5, 17 % 5)?",
    options: ["3 5", "3.4 2", "3 2", "2 3"],
    answer: 2,
    explain: "// gives floor division quotient 3, while % gives remainder 2."
  },
  {
    id: "py-em-04",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(bool(0), bool(''))?",
    options: ["True True", "False True", "True False", "False False"],
    answer: 3,
    explain: "Zero and empty strings are falsy values in Python."
  },
  {
    id: "py-em-05",
    subject: "python",
    tier: "easy-medium",
    q: "What is printed by:\nx = 0\nfor i in [1, 2, 3]:\n    if i == 2: break\n    x += i\nprint(x)",
    options: ["1", "3", "6", "0"],
    answer: 0,
    explain: "The loop breaks when i is 2, so only 1 is added to x."
  },
  {
    id: "py-em-06",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print([0, 1, 2, 3, 4][::2])?",
    options: ["[0, 1]", "[0, 2, 4]", "[1, 3]", "[2, 4]"],
    answer: 1,
    explain: "The slice step 2 selects every second element starting at index 0."
  },
  {
    id: "py-m-01",
    subject: "python",
    tier: "medium",
    q: "What is printed?\na = [1, 2]\nb = a\nb.append(3)\nprint(len(a))",
    options: ["1", "2", "3", "Error"],
    answer: 2,
    explain: "Variables a and b reference the same list object in memory, so mutating b affects a."
  },
  {
    id: "py-m-02",
    subject: "python",
    tier: "medium",
    q: "What is the output of print({'a': 1}.get('b', 99))?",
    options: ["None", "KeyError", "1", "99"],
    answer: 3,
    explain: "The get method returns the default value 99 when the key 'b' is missing."
  },
  {
    id: "py-m-03",
    subject: "python",
    tier: "medium",
    q: "What is the output of print([x * 2 for x in range(4) if x % 2 == 1])?",
    options: ["[0, 4]", "[1, 3]", "[2, 6]", "[0, 2, 4, 6]"],
    answer: 2,
    explain: "The comprehension filters odd values 1 and 3, then doubles them to 2 and 6."
  },
  {
    id: "py-m-04",
    subject: "python",
    tier: "medium",
    q: "What is the output of print('gesture'[::-1])?",
    options: ["gesture", "gest", "rugtse", "erutseg"],
    answer: 3,
    explain: "A step of -1 traverses and reverses the entire string."
  },
  {
    id: "py-m-05",
    subject: "python",
    tier: "medium",
    q: "What is the output of:\nx, *y, z = [1, 2, 3, 4]\nprint(y)",
    options: ["[2, 3]", "[2]", "[2, 3, 4]", "(2, 3)"],
    answer: 0,
    explain: "Extended unpacking captures the middle elements into a list y."
  },
  {
    id: "py-m-06",
    subject: "python",
    tier: "medium",
    q: "What is the output of:\nf = lambda x, y=2: x * y\nprint(f(5))",
    options: ["5", "10", "25", "Error"],
    answer: 1,
    explain: "The lambda uses default parameter y=2, yielding 5 * 2 = 10."
  }
];
