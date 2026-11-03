const fs = require('fs');
const path = require('path');
const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) throw new Error('android/app/build.gradle not found. Run expo prebuild first.');
for (const name of ['ANDROID_KEYSTORE_FILE','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD']) {
  if (!process.env[name]) throw new Error('Missing environment variable: ' + name);
}
let source = fs.readFileSync(gradlePath, 'utf8');
function matchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error('Unbalanced Gradle braces.');
}
const buildTypesIndex = source.indexOf('buildTypes {');
if (buildTypesIndex < 0) throw new Error('Could not locate Android buildTypes block.');
if (!source.includes('signingConfigs.release')) {
  const signing = `signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_FILE'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }

    `;
  source = source.slice(0, buildTypesIndex) + signing + source.slice(buildTypesIndex);
}
const updatedBuildTypesIndex = source.indexOf('buildTypes {');
const releaseIndex = source.indexOf('release {', updatedBuildTypesIndex);
if (releaseIndex < 0) throw new Error('Could not locate release build type.');
const openBrace = source.indexOf('{', releaseIndex);
const closeBrace = matchingBrace(source, openBrace);
let releaseBlock = source.slice(releaseIndex, closeBrace + 1);
if (releaseBlock.includes('signingConfigs.debug')) releaseBlock = releaseBlock.replace('signingConfigs.debug', 'signingConfigs.release');
else if (!releaseBlock.includes('signingConfigs.release')) releaseBlock = releaseBlock.replace('{', '{\\n            signingConfig signingConfigs.release');
source = source.slice(0, releaseIndex) + releaseBlock + source.slice(closeBrace + 1);
fs.writeFileSync(gradlePath, source);
console.log('Release signing configured.');
