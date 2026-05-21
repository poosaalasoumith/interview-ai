export const SUPPORTED_LANGUAGES = [
  { id: "javascript", name: "JavaScript", extension: "js", version: "18.15.0" },
  { id: "typescript", name: "TypeScript", extension: "ts", version: "5.0.3" },
  { id: "python", name: "Python", extension: "py", version: "3.10.0" },
  { id: "java", name: "Java", extension: "java", version: "15.0.2" },
  { id: "cpp", name: "C++", extension: "cpp", version: "10.2.0" },
  { id: "c", name: "C", extension: "c", version: "10.2.0" },
  { id: "go", name: "Go", extension: "go", version: "1.16.2" },
];

export const LANGUAGE_TEMPLATES: Record<string, string> = {
  javascript: `// JavaScript Starter Template
function solve() {
  console.log("Hello, World!");
}

solve();`,
  typescript: `// TypeScript Starter Template
function solve(): void {
  console.log("Hello, World!");
}

solve();`,
  python: `# Python Starter Template
def solve():
    print("Hello, World!")

if __name__ == "__main__":
    solve()`,
  java: `// Java Starter Template
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  cpp: `// C++ Starter Template
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  c: `// C Starter Template
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`,
  go: `// Go Starter Template
package main
import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
};
