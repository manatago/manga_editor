"""
rembg を CLI ライブラリ (typer/click/gradio) なしで直接呼び出す。
Usage: python invoke-rembg.py i -m <model> <input.png> <output.png>
"""
import sys


def main() -> int:
    args = sys.argv[1:]  # 例: ['i', '-m', 'isnet-anime', 'in.png', 'out.png']

    if not args or args[0] != 'i':
        print("Usage: invoke-rembg.py i -m <model> <input> <output>", file=sys.stderr)
        return 1

    model = 'isnet-anime'
    positional: list[str] = []
    i = 1
    while i < len(args):
        if args[i] == '-m' and i + 1 < len(args):
            model = args[i + 1]
            i += 2
        else:
            positional.append(args[i])
            i += 1

    if len(positional) < 2:
        print("Missing input/output paths", file=sys.stderr)
        return 1

    input_path, output_path = positional[0], positional[1]

    from pathlib import Path
    from rembg import new_session, remove  # type: ignore[import]

    session = new_session(model)
    input_data = Path(input_path).read_bytes()
    output_data = remove(input_data, session=session)
    Path(output_path).write_bytes(output_data)
    return 0


if __name__ == '__main__':
    sys.exit(main())
