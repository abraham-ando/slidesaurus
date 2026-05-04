Feature: Presentation Scanning
  As a documentation author
  I want the plugin to scan my slidev directory
  So that presentations are automatically discovered

  Scenario: Discover presentations in flat directory
    Given a slidev directory with the following files:
      | file           | title           |
      | intro.md       | Introduction    |
      | advanced.md    | Advanced Topics |
    When the plugin scans for presentations
    Then 2 presentations should be found
    And the presentation "intro" should have title "Introduction"

  Scenario: Discover presentations in nested categories
    Given a slidev directory with the following structure:
      | path                      | title           |
      | basics/getting-started.md | Getting Started |
      | basics/setup.md           | Setup Guide     |
      | advanced/deep-dive.md     | Deep Dive       |
    And a category file "basics/_category_.yml" with:
      | label  | position |
      | Basics | 1        |
    When the plugin scans for presentations
    Then 3 presentations should be found
    And 2 categories should be found
    And the category "basics" should have label "Basics"

  Scenario: Ignore non-presentation files
    Given a slidev directory with the following files:
      | file           | title      |
      | intro.md       | Intro      |
      | _draft.md      | Draft      |
      | .hidden.md     | Hidden     |
    When the plugin scans for presentations
    Then 1 presentation should be found
