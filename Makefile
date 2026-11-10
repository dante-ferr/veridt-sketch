.PHONY: docs-serve test up verify

docs-serve:
	@which mdbook > /dev/null || (echo "mdBook is not installed. Install from https://github.com/rust-lang/mdBook/releases or with cargo install mdbook" && exit 1)
	@echo "Documentation server at http://localhost:3000"
	mdbook serve docs

test:
	npm test

up:
	docker compose up --build

verify:
	node scripts/verify-flows.mjs
