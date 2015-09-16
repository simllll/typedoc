var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ShellJS = require("shelljs");
var Path = require("path");
var component_1 = require("../../utils/component");
var base_path_1 = require("../utils/base-path");
var converter_1 = require("../converter");
var Repository = (function () {
    function Repository(path) {
        var _this = this;
        this.branch = 'master';
        this.files = [];
        this.path = path;
        ShellJS.pushd(path);
        var out = ShellJS.exec('git ls-remote --get-url', { silent: true });
        if (out.code == 0) {
            var url;
            var remotes = out.output.split('\n');
            for (var i = 0, c = remotes.length; i < c; i++) {
                url = /github\.com[:\/]([^\/]+)\/(.*)/.exec(remotes[i]);
                if (url) {
                    this.gitHubUser = url[1];
                    this.gitHubProject = url[2];
                    if (this.gitHubProject.substr(-4) == '.git') {
                        this.gitHubProject = this.gitHubProject.substr(0, this.gitHubProject.length - 4);
                    }
                    break;
                }
            }
        }
        out = ShellJS.exec('git ls-files', { silent: true });
        if (out.code == 0) {
            out.output.split('\n').forEach(function (file) {
                if (file != '') {
                    _this.files.push(base_path_1.BasePath.normalize(path + '/' + file));
                }
            });
        }
        out = ShellJS.exec('git rev-parse --abbrev-ref HEAD', { silent: true });
        if (out.code == 0) {
            this.branch = out.output.replace('\n', '');
        }
        ShellJS.popd();
    }
    Repository.prototype.contains = function (fileName) {
        return this.files.indexOf(fileName) != -1;
    };
    Repository.prototype.getGitHubURL = function (fileName) {
        if (!this.gitHubUser || !this.gitHubProject || !this.contains(fileName)) {
            return null;
        }
        return [
            'https://github.com',
            this.gitHubUser,
            this.gitHubProject,
            'blob',
            this.branch,
            fileName.substr(this.path.length + 1)
        ].join('/');
    };
    Repository.tryCreateRepository = function (path) {
        ShellJS.pushd(path);
        var out = ShellJS.exec('git rev-parse --show-toplevel', { silent: true });
        ShellJS.popd();
        if (out.code != 0)
            return null;
        return new Repository(base_path_1.BasePath.normalize(out.output.replace("\n", '')));
    };
    return Repository;
})();
var GitHubPlugin = (function (_super) {
    __extends(GitHubPlugin, _super);
    function GitHubPlugin() {
        _super.apply(this, arguments);
        this.repositories = {};
        this.ignoredPaths = [];
    }
    GitHubPlugin.prototype.initialize = function () {
        ShellJS.config.silent = true;
        if (ShellJS.which('git')) {
            this.listenTo(this.owner, converter_1.Converter.EVENT_RESOLVE_END, this.onEndResolve);
        }
    };
    GitHubPlugin.prototype.getRepository = function (fileName) {
        var dirName = Path.dirname(fileName);
        for (var i = 0, c = this.ignoredPaths.length; i < c; i++) {
            if (this.ignoredPaths[i] == dirName) {
                return null;
            }
        }
        for (var path in this.repositories) {
            if (!this.repositories.hasOwnProperty(path))
                continue;
            if (fileName.substr(0, path.length) == path) {
                return this.repositories[path];
            }
        }
        var repository = Repository.tryCreateRepository(dirName);
        if (repository) {
            this.repositories[repository.path] = repository;
            return repository;
        }
        var segments = dirName.split('/');
        for (var i = segments.length; i > 0; i--) {
            this.ignoredPaths.push(segments.slice(0, i).join('/'));
        }
        return null;
    };
    GitHubPlugin.prototype.onEndResolve = function (context) {
        var _this = this;
        var project = context.project;
        project.files.forEach(function (sourceFile) {
            var repository = _this.getRepository(sourceFile.fullFileName);
            if (repository) {
                sourceFile.url = repository.getGitHubURL(sourceFile.fullFileName);
            }
        });
        for (var key in project.reflections) {
            var reflection = project.reflections[key];
            if (reflection.sources)
                reflection.sources.forEach(function (source) {
                    if (source.file && source.file.url) {
                        source.url = source.file.url + '#L' + source.line;
                    }
                });
        }
    };
    GitHubPlugin = __decorate([
        component_1.Component('gitHub'), 
        __metadata('design:paramtypes', [])
    ], GitHubPlugin);
    return GitHubPlugin;
})(component_1.ConverterComponent);
exports.GitHubPlugin = GitHubPlugin;