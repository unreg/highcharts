var eslint = require('gulp-eslint'),
    gulp = require('gulp'),
    fs = require('fs'),
    config = {
        // List of rules at http://eslint.org/docs/rules/
        // @todo Add more rules when ready.
        rules: {
            "comma-dangle": [2, "never"],
            "no-cond-assign": [1, "always"]
        }
    },
    paths = {
        "buildsDir": "./js/builds",
        "distributions": ['./js/highcharts-3d.src.js', './js/highcharts-more.src.js', './js/highcharts.src.js', './js/highmaps.src.js', './js/highstock.src.js'],
        "modules": ['./js/modules/*.js'],
        "parts": ['./js/parts/*.js'],
        "parts3D": ['./js/parts-3d/*.js'],
        "partsMap": ['./js/parts-map/*.js'],
        "partsMore": ['./js/parts-more/*.js'],
        "themes": ['./js/themes/*.js']
    },
    optimizeHighcharts = function (fs, path) {
        var wrapFile = './js/parts/Intro.js',
            WS = '\\s*',
            CM = ',',
            captureQuoted = "'([^']+)'",
            captureArray = "\\[(.*?)\\]",
            captureFunc = "(function[\\s\\S]*?\\})\\);((?=\\s*define)|\\s*$)",
            defineStatements = new RegExp('define\\(' + WS + captureQuoted + WS + CM + WS + captureArray + WS + CM + WS + captureFunc, 'g');
        fs.readFile(path, 'utf8', function (err, data) {
            var lines = data.split("\n"),
                wrap = fs.readFileSync(wrapFile, 'utf8');
            lines.forEach(function (line, i) {
                if (line.indexOf("define") !== -1) {
                    lines[i] = lines[i].replace(/\.\//g, ''); // Remove all beginnings of relative paths
                    lines[i] = lines[i].replace(/\//g, '_'); // Replace all forward slashes with underscore
                    lines[i] = lines[i].replace(/"/g, ''); // Remove all double quotes
                }
            });
            data = lines.join('\n'); // Concatenate lines
            data = data.replace(defineStatements, 'var $1 = ($3($2));'); // Replace define statement with a variable declaration
            wrap = wrap.replace(/.*@code.*/, data); // Insert code into UMD wrap
            fs.writeFile(path, wrap, 'utf8');
        });

    },
    bundleHighcharts = function (file) {
        var requirejs = require('requirejs'),
            fileName = file.slice(0, -3), // Remove file extension (.js) from name
            config = {
                baseUrl: './js/',
                name: 'builds/' + fileName,
                optimize: 'none',
                out: './js/' + file,
                onModuleBundleComplete: function (info) {
                    optimizeHighcharts(fs, info.path);
                }
            };

        requirejs.optimize(config, function (buildResponse) {
            console.log("Successfully build " + fileName);
        }, function(err) {
            console.log(err.originalError);
        });
    };

gulp.task('build', function () {
    var buildFiles = fs.readdirSync(paths.buildsDir);
    buildFiles.forEach(bundleHighcharts);
});

function doLint(paths) {
    return gulp.src(paths)
        .pipe(eslint(config))
        .pipe(eslint.formatEach())
        .pipe(eslint.failOnError());
}

gulp.task('lint', function () {
    var p = paths,
        all = p.distributions.concat(p.modules, p.parts, p.parts3D, p.partsMap, p.partsMore, p.themes);
    return doLint(all);
});

gulp.task('lint-distributions', function () {
    return doLint(paths.distributions);
});

gulp.task('lint-modules', function () {
    return doLint(paths.modules);
});

gulp.task('lint-parts', function () {
    return doLint(paths.parts);
});

gulp.task('lint-parts-3d', function () {
    return doLint(paths.parts3D);
});

gulp.task('lint-parts-map', function () {
    return doLint(paths.partsMap);
});

gulp.task('lint-parts-more', function () {
    return doLint(paths.partsMore);
});

gulp.task('lint-themes', function () {
    return doLint(paths.themes);
});

/**
 * Proof of concept to parse super code. Move this logic into the standard build when ready.
 */
gulp.task('preprocess', function () {
    /**
     * Micro-optimize code based on the build object.
     */
    function preprocess(tpl, build) {
        // Escape double quotes and backslashes, to be reinserted after parsing
        tpl = tpl.replace(/"/g, '___doublequote___');
        tpl = tpl.replace(/\\/g, '\\\\');


        // Prepare newlines
        tpl = tpl.replace(/\n/g, '\\n');

        // Start supercode output, start first output string
        tpl = tpl.replace(/^/, 'var s = "');
        // Start supercode block, closes output string
        tpl = tpl.replace(/\/\*=\s?/g, '";\n');
        // End of supercode block, starts output string
        tpl = tpl.replace(/=\*\//g, '\ns += "');
        // End supercode output, end last output string
        tpl = tpl.replace(/$/, '";\nreturn s;');

        // Uncomment to preview generated supercode
        // fs.writeFile('temp.js', tpl, 'utf8');

        // The evaluation function for the ready built supercode
        func = new Function('build', tpl);

        tpl = func(build);
        tpl = tpl.replace(/___doublequote___/g, '"');

        return tpl;
    }


    paths.distributions.forEach(function (path) {
        fs.readFile(path, 'utf8', function (err, tpl) {
            
            // Create the classic file
            fs.writeFile(
                path,
                preprocess(tpl, {
                    classic: true
                }), 
                'utf8'
            );

            // Create the unstyled file
            fs.writeFile(
                path.replace('.src.js', '.unstyled.src.js'), 
                preprocess(tpl, {
                    classic: false
                }), 
                'utf8'
            );
        });
    });
});