# TODO Comment to GitLab Issue

This tool automatically creates GitLab issues in a project, based on the appereances of `TODO:`, `FIXME:`, `BUG:` or `HACK:` in the code.

The tool is intended to run in a GitLab CI Pipeline, an example `.gitlab-ci.yml` could look like this:

```yaml
todos:
  image: node:18
  script: npx --yes @dervondenbergen/gitlab-todo-issues
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: always
```

For the tool to be able to manage issues, it needs an Access Token. It needs at least **Reporter** role and the **api** scope.

To use the Token, set it as variable with the name `TODO_BOT_TOKEN` in the CI/CD Variable Settings: https://docs.gitlab.com/ee/ci/variables/#for-a-project

All other variables are automatically defined by the CI Pipeline: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html

## Customization

- The default label, which gets assigned to the issues is **Todo Bot**. This can be customized with the `TODO_BOT_NAME` variable.
- By default will the tool look for the keywords listed above, if the keywords should be different, pass them to the `TODO_BOT_TAGS` variable like this: **`TODO|FIXME|BUG|HACK`**.
