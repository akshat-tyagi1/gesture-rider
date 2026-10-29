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
    id: "py-e-09",
    subject: "python",
    tier: "easy",
    q: "Which list method adds an element to the end of a list?",
    options: ["append()", "push()", "add()", "insert()"],
    answer: 0,
    explain: "The append method adds an item to the end of an existing list."
  },
  {
    id: "py-e-10",
    subject: "python",
    tier: "easy",
    q: "Which keyword is used to define a function in Python?",
    options: ["func", "def", "function", "lambda"],
    answer: 1,
    explain: "Functions in Python are defined using the def keyword."
  },
  {
    id: "py-e-11",
    subject: "python",
    tier: "easy",
    q: "Which string method converts all characters in a string to lowercase?",
    options: ["to_lower()", "small()", "lower()", "down()"],
    answer: 2,
    explain: "The lower method returns a copy of the string converted to lowercase."
  },
  {
    id: "py-e-12",
    subject: "python",
    tier: "easy",
    q: "What function converts the string '42' into an integer?",
    options: ["parse()", "to_int()", "Integer()", "int()"],
    answer: 3,
    explain: "The int function converts compatible strings or floats to an integer."
  },
  {
    id: "py-e-13",
    subject: "python",
    tier: "easy",
    q: "Which symbol is used to create a tuple in Python?",
    options: ["()", "[]", "{}", "<>"],
    answer: 0,
    explain: "Tuples in Python are defined using parentheses ()."
  },
  {
    id: "py-e-14",
    subject: "python",
    tier: "easy",
    q: "What does the expression not True evaluate to?",
    options: ["None", "False", "0", "True"],
    answer: 1,
    explain: "The not operator negates a boolean value, so not True becomes False."
  },
  {
    id: "py-e-15",
    subject: "python",
    tier: "easy",
    q: "What is the first character index in any Python sequence?",
    options: ["1", "-1", "0", "first"],
    answer: 2,
    explain: "Python uses zero-based indexing, so the first element is at index 0."
  },
  {
    id: "py-e-16",
    subject: "python",
    tier: "easy",
    q: "Which keyword deletes a variable or dictionary key in Python?",
    options: ["remove", "discard", "pop", "del"],
    answer: 3,
    explain: "The del statement deletes variables, list items, or dictionary keys."
  },
  {
    id: "py-e-17",
    subject: "python",
    tier: "easy",
    q: "What is the output of print('hi' * 3)?",
    options: ["hihihi", "hi3", "hi hi hi", "Error"],
    answer: 0,
    explain: "Multiplying a string by an integer repeats that string."
  },
  {
    id: "py-e-18",
    subject: "python",
    tier: "easy",
    q: "Which keyword immediately skips to the next iteration of a loop?",
    options: ["pass", "continue", "skip", "next"],
    answer: 1,
    explain: "The continue statement ends the current iteration and begins the next one."
  },
  {
    id: "py-e-19",
    subject: "python",
    tier: "easy",
    q: "In Python, which index refers to the last element of a list?",
    options: ["len(list)", "end", "-1", "last"],
    answer: 2,
    explain: "Negative index -1 accesses the final item of any sequence."
  },
  {
    id: "py-e-20",
    subject: "python",
    tier: "easy",
    q: "Which operator tests whether two variables point to the same object in memory?",
    options: ["==", "equals", "=", "is"],
    answer: 3,
    explain: "The is operator checks for object identity rather than value equality."
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
    id: "py-em-07",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print('a,b,c'.split(','))?",
    options: ["'a', 'b', 'c'", "['a,b,c']", "['a', 'b', 'c']", "('a', 'b', 'c')"],
    answer: 2,
    explain: "The split method breaks a string on delimiter commas and returns a list."
  },
  {
    id: "py-em-08",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(len({1, 2, 2, 3, 3, 3}))?",
    options: ["6", "1", "4", "3"],
    answer: 3,
    explain: "Sets automatically discard duplicate values, leaving only three unique items."
  },
  {
    id: "py-em-09",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of:\nd = {'x': 10, 'y': 20}\nprint(list(d.keys()))",
    options: ["['x', 'y']", "[10, 20]", "[('x', 10), ('y', 20)]", "['x': 10, 'y': 20]"],
    answer: 0,
    explain: "The keys method retrieves the dictionary keys, which list wraps into a list."
  },
  {
    id: "py-em-10",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of:\nname = 'Ada'\nprint(f'Hello {name}')",
    options: ["Hello {name}", "Hello Ada", "f'Hello Ada'", "Hello {Ada}"],
    answer: 1,
    explain: "F-strings evaluate expressions inside curly braces and interpolate them into text."
  },
  {
    id: "py-em-11",
    subject: "python",
    tier: "easy-medium",
    q: "What is printed by:\nnums = [10, 20, 30]\nval = nums.pop()\nprint(val)",
    options: ["10", "20", "30", "None"],
    answer: 2,
    explain: "Without an index argument, pop removes and returns the last element of the list."
  },
  {
    id: "py-em-12",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(list(range(1, 10, 3)))?",
    options: ["[1, 4, 7, 10]", "[3, 6, 9]", "[1, 3, 6, 9]", "[1, 4, 7]"],
    answer: 3,
    explain: "The range starts at 1 and steps by 3 up to 10 non-inclusively, producing 1, 4, 7."
  },
  {
    id: "py-em-13",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print('-'.join(['a', 'b', 'c']))?",
    options: ["a-b-c", "-a-b-c-", "abc", "['a-b-c']"],
    answer: 0,
    explain: "The join method places the separator between each string element in the list."
  },
  {
    id: "py-em-14",
    subject: "python",
    tier: "easy-medium",
    q: "What happens when running: t = (1, 2); t[0] = 9?",
    options: ["t becomes (9, 2)", "TypeError is raised", "ValueError is raised", "t becomes [9, 2]"],
    answer: 1,
    explain: "Tuples are immutable in Python, so assigning to an index raises a TypeError."
  },
  {
    id: "py-em-15",
    subject: "python",
    tier: "easy-medium",
    q: "What is printed by:\nnums = [3, 1, 2]\nres = nums.sort()\nprint(res)",
    options: ["[1, 2, 3]", "[3, 2, 1]", "None", "Error"],
    answer: 2,
    explain: "The sort method sorts a list in-place and returns None."
  },
  {
    id: "py-em-16",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(0 or 5)?",
    options: ["0", "False", "True", "5"],
    answer: 3,
    explain: "The or operator evaluates to the first truthy operand, which is 5."
  },
  {
    id: "py-em-17",
    subject: "python",
    tier: "easy-medium",
    q: "What is printed by:\ndef add(a, b=4):\n    return a + b\nprint(add(3, 2))",
    options: ["5", "7", "9", "Error"],
    answer: 0,
    explain: "Passing 2 explicitly overrides the default value 4 for argument b."
  },
  {
    id: "py-em-18",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print([1, 2, 3, 4][::-2])?",
    options: ["[1, 3]", "[4, 2]", "[3, 1]", "[2, 4]"],
    answer: 1,
    explain: "Stepping by -2 walks backwards from the last element, picking indices 3 and 1."
  },
  {
    id: "py-em-19",
    subject: "python",
    tier: "easy-medium",
    q: "What is printed by:\nd = {'a': 1}\nd['a'] = 5\nprint(d['a'])",
    options: ["1", "6", "5", "KeyError"],
    answer: 2,
    explain: "Assigning to an existing dictionary key updates its value to the new one."
  },
  {
    id: "py-em-20",
    subject: "python",
    tier: "easy-medium",
    q: "What is the output of print(list(zip([1, 2], ['a', 'b'])))?",
    options: ["[[1, 2], ['a', 'b']]", "[1, 2, 'a', 'b']", "['1a', '2b']", "[(1, 'a'), (2, 'b')]"],
    answer: 3,
    explain: "zip pairs corresponding elements from each iterable into tuples."
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
  },
  {
    id: "py-m-07",
    subject: "python",
    tier: "medium",
    q: "What is printed by:\ndef fn(x, lst=[]):\n    lst.append(x)\n    return lst\nfn(1); print(fn(2))",
    options: ["[1, 2]", "[2]", "[1]", "Error"],
    answer: 0,
    explain: "Default list arguments are evaluated once at definition time and shared across calls."
  },
  {
    id: "py-m-08",
    subject: "python",
    tier: "medium",
    q: "What is the output of print({x: x**2 for x in (1, 2, 3) if x != 2})?",
    options: ["{1: 1, 2: 4, 3: 9}", "{1: 1, 3: 9}", "{1: 2, 3: 6}", "[1, 9]"],
    answer: 1,
    explain: "The comprehension squares keys 1 and 3, filtering out 2."
  },
  {
    id: "py-m-09",
    subject: "python",
    tier: "medium",
    q: "What is printed?\na = [[0], [1]]\nb = a.copy()\nb[0].append(9)\nprint(a[0])",
    options: ["[0, 9]", "[0]", "[9]", "[[0, 9], [1]]"],
    answer: 0,
    explain: "A shallow copy creates a new outer list, but inner lists remain shared references."
  },
  {
    id: "py-m-10",
    subject: "python",
    tier: "medium",
    q: "What is printed?\nx = 5\ndef f():\n    x = 10\nf()\nprint(x)",
    options: ["10", "5", "None", "UnboundLocalError"],
    answer: 1,
    explain: "Assigning to x inside f binds a local variable without modifying the global x."
  },
  {
    id: "py-m-11",
    subject: "python",
    tier: "medium",
    q: "What is the output of print(all([True, 1, 'yes']), any([0, '', False]))?",
    options: ["True False", "True True", "False False", "False True"],
    answer: 0,
    explain: "all requires every element to be truthy, while any finds no truthy value in all-falsy items."
  },
  {
    id: "py-m-12",
    subject: "python",
    tier: "medium",
    q: "What is the output of print(sum(x for x in range(5) if x % 2 == 0))?",
    options: ["10", "6", "4", "12"],
    answer: 1,
    explain: "Even numbers in range(5) are 0, 2, and 4, which sum to 6."
  },
  {
    id: "py-m-13",
    subject: "python",
    tier: "medium",
    q: "What is the output of print(min(['pear', 'apple', 'fig'], key=len))?",
    options: ["fig", "pear", "apple", "3"],
    answer: 0,
    explain: "The min function uses the key function len to find the shortest string."
  },
  {
    id: "py-m-14",
    subject: "python",
    tier: "medium",
    q: "What is printed by:\ndef f(*args):\n    return sum(args)\nprint(f(1, 2, 3, 4))",
    options: ["24", "10", "(1, 2, 3, 4)", "4"],
    answer: 1,
    explain: "The *args parameter packs arguments into a tuple (1, 2, 3, 4), whose sum is 10."
  },
  {
    id: "py-m-15",
    subject: "python",
    tier: "medium",
    q: "What is printed by:\nd = {'count': 1}\nd.setdefault('count', 0)\nprint(d['count'])",
    options: ["0", "None", "1", "KeyError"],
    answer: 2,
    explain: "Because 'count' already exists, setdefault does not change its existing value 1."
  },
  {
    id: "py-m-16",
    subject: "python",
    tier: "medium",
    q: "What is the output of print({1, 2, 3} ^ {2, 3, 4})?",
    options: ["{2, 3}", "{1, 2, 3, 4}", "set()", "{1, 4}"],
    answer: 3,
    explain: "The caret operator calculates symmetric difference, keeping items in exactly one set."
  },
  {
    id: "py-m-17",
    subject: "python",
    tier: "medium",
    q: "What is the output of print(list(filter(lambda x: x > 2, [1, 2, 3, 4])))?",
    options: ["[1, 2]", "[3]", "[3, 4]", "[2, 3, 4]"],
    answer: 2,
    explain: "filter keeps only the elements where the lambda condition x > 2 is True."
  },
  {
    id: "py-m-18",
    subject: "python",
    tier: "medium",
    q: "What is the output of print('a-b-c-d'.split('-', 2))?",
    options: ["['a', 'b']", "['a-b', 'c-d']", "['a', 'b', 'c', 'd']", "['a', 'b', 'c-d']"],
    answer: 3,
    explain: "The maxsplit argument limits splits to 2, leaving the remainder intact."
  },
  {
    id: "py-m-19",
    subject: "python",
    tier: "medium",
    q: "What is the output of print(dict(enumerate(['x', 'y'], start=1)))?",
    options: ["{0: 'x', 1: 'y'}", "{'x': 1, 'y': 2}", "{1: 'x', 2: 'y'}", "[('1', 'x'), ('2', 'y')]"],
    answer: 2,
    explain: "enumerate produces index-value pairs starting at 1, which dict maps to keys and values."
  },
  {
    id: "py-m-20",
    subject: "python",
    tier: "medium",
    q: "What is printed by:\ndef f(n):\n    return 1 if n <= 1 else n * f(n - 1)\nprint(f(4))",
    options: ["4", "10", "12", "24"],
    answer: 3,
    explain: "The recursive function computes the factorial of 4, which is 4 * 3 * 2 * 1 = 24."
  }
];
