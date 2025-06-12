// scripts/refactor.cjs
const { Project } = require("ts-morph");
const path = require("path");
const fs = require("fs");

// ✅ Setup ts-morph project
const project = new Project({
  tsConfigFilePath: "tsconfig.refactor.json",
});

function moveFileAndUpdateImports(oldPath, newPath) {
  const oldAbs = path.resolve(oldPath);
  const newAbs = path.resolve(newPath);

  const sourceFile = project.getSourceFile(oldAbs);
  if (!sourceFile) {
    console.warn(`⚠️ Skipping (not found in tsconfig): ${oldPath}`);
    return;
  }

  if (!fs.existsSync(oldAbs)) {
    console.warn(`⚠️ Skipping (file missing on disk): ${oldPath}`);
    return;
  }

  fs.mkdirSync(path.dirname(newAbs), { recursive: true });
  fs.renameSync(oldAbs, newAbs);

  project.removeSourceFile(sourceFile);
  const newFile = project.addSourceFileAtPath(newAbs);
  newFile.refreshFromFileSystemSync();

  for (const file of project.getSourceFiles()) {
    for (const imp of file.getImportDeclarations()) {
      const impSource = imp.getModuleSpecifierSourceFile();
      if (impSource?.getFilePath() === oldAbs) {
        const newRel = path
          .relative(path.dirname(file.getFilePath()), newAbs)
          .replace(/\\/g, "/")
          .replace(/\.(tsx|ts)$/, "");
        imp.setModuleSpecifier(newRel.startsWith(".") ? newRel : `./${newRel}`);
      }
    }
  }

  console.log(`✅ Moved: ${oldPath} → ${newPath}`);
}

// 🧱 All file moves (partial list shown; extend as needed)
const filesToMove = [
  { from: "src/App.tsx", to: "src/app/App.tsx" },
  { from: "src/App.css", to: "src/app/App.css" },
  { from: "src/main.tsx", to: "src/app/main.tsx" },
  { from: "src/global.d.ts", to: "src/types/global.d.ts" },
  { from: "src/vite-env.d.ts", to: "src/types/vite-env.d.ts" },

  { from: "src/pages/ScanPage.tsx", to: "src/pages/ScanPage/ScanPage.tsx" },
  { from: "src/pages/ScanPage.css", to: "src/pages/ScanPage/ScanPage.css" },
  { from: "src/pages/LoginPage.tsx", to: "src/pages/LoginPage/LoginPage.tsx" },
  { from: "src/pages/RegisterPage.tsx", to: "src/pages/RegisterPage/RegisterPage.tsx" },
  { from: "src/pages/CollectionsOverview.tsx", to: "src/pages/CollectionsOverview/CollectionsOverview.tsx" },
  { from: "src/pages/CollectionDetails.tsx", to: "src/pages/CollectionDetails/CollectionDetails.tsx" },
  { from: "src/pages/AccountSetupPage.tsx", to: "src/pages/AccountSetupPage/AccountSetupPage.tsx" },
  { from: "src/components/GithubButton.tsx", to: "src/components/auth/GithubButton.tsx" },
  { from: "src/components/GoogleButton.tsx", to: "src/components/auth/GoogleButton.tsx" },
  { from: "src/components/CameraPanel.tsx", to: "src/components/camera/CameraPanel.tsx" },
  { from: "src/components/CameraStream.tsx", to: "src/components/camera/CameraStream.tsx" },
  { from: "src/components/LastScannedCard.tsx", to: "src/components/camera/LastScannedCard.tsx" },
  { from: "src/components/FilterPanel.tsx", to: "src/components/filters/FilterPanel.tsx" },
  { from: "src/components/ColorFilter.tsx", to: "src/components/filters/ColorFilter.tsx" },
  { from: "src/components/SearchResults.tsx", to: "src/components/filters/SearchResults.tsx" },
  { from: "src/components/CollectionValue.tsx", to: "src/components/collections/CollectionValue.tsx" },
  { from: "src/components/BulkCardAdder.tsx", to: "src/components/cards/BulkCardAdder.tsx" },
  { from: "src/components/ToggleableImage.tsx", to: "src/components/cards/ToggleableImage.tsx" },
  { from: "src/components/AlternatePrintingsDialog.tsx", to: "src/components/dialogs/AlternatePrintingsDialog.tsx" },
  { from: "src/components/LinkAccountDialog.tsx", to: "src/components/dialogs/LinkAccountDialog.tsx" },
  { from: "src/components/NavigationDrawer.tsx", to: "src/components/layout/NavigationDrawer.tsx" },
  { from: "src/components/ProtectedRoute.tsx", to: "src/components/layout/ProtectedRoute.tsx" },
  { from: "src/components/PublicOrProtectedRoute.tsx", to: "src/components/layout/PublicOrProtectedRoute.tsx" },
  { from: "src/components/Model.tsx", to: "src/components/shared/Model.tsx" },
  { from: "src/hooks/useFrameProcessor.ts", to: "src/hooks/useFrameProcessor.ts" },
  { from: "src/hooks/CarouselErrorBoundary.tsx", to: "src/hooks/CarouselErrorBoundary.tsx" },
];

filesToMove.forEach(({ from, to }) => moveFileAndUpdateImports(from, to));
project.saveSync();

console.log("\n🎉 Done. All files moved and imports updated.");