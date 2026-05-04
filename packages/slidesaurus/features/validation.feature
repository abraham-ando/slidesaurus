Feature: Plugin Option Validation
  As a plugin user
  I want clear validation of my configuration
  So that misconfiguration is caught early

  Scenario: Valid default configuration
    Given default plugin options
    When the options are validated
    Then validation should succeed

  Scenario: Custom valid configuration
    Given plugin options:
      | option        | value      |
      | path          | ./slides   |
      | routeBasePath | /my-slides |
      | theme         | seriph     |
      | buildTimeout  | 60         |
    When the options are validated
    Then validation should succeed
    And the path option should be "./slides"

  Scenario: Invalid build timeout
    Given plugin options:
      | option       | value |
      | buildTimeout | 5     |
    When the options are validated
    Then validation should fail with message containing "buildTimeout"
