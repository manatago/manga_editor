# Fix setProjectData closing
sed -i '' 's/                })/                })\n            }))/g' src/renderer/src/store/useMangaStore.ts

# Fix EOF closing
sed -i '' -e '$d' src/renderer/src/store/useMangaStore.ts 
echo "    };" >> src/renderer/src/store/useMangaStore.ts
echo "});" >> src/renderer/src/store/useMangaStore.ts

npx tsc --noEmit
